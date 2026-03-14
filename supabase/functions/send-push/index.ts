// send-push edge function
// Sends a Web Push notification to one or more subscribers using VAPID.
// Called by the send-message function when channel === 'push'.
//
// Request body:
//   {
//     subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
//     title: string,
//     body: string,
//     url?: string,
//     tag?: string,
//   }
//
// VAPID keys are read from org_settings in the database.
// Required env var: SUPABASE_SERVICE_ROLE_KEY (injected automatically by Supabase)

import { createClient } from 'jsr:@supabase/supabase-js@2'

// ─── VAPID JWT / Encryption helpers ──────────────────────────────────────────
// Web Push requires:
//   1. A VAPID JWT signed with the private key (ES256 / P-256)
//   2. An encrypted payload (aes128gcm, ECDH with subscriber's public key)
//
// We implement both using the Web Crypto API available in Deno/Edge runtime.

function base64UrlDecode(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const b of arr) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function buildVapidJwt(
  audience: string,
  subject: string,
  privateKeyJwk: JsonWebKey
): Promise<string> {
  const header = { alg: 'ES256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject }

  const encHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)))
  const encPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)))
  const sigInput = `${encHeader}.${encPayload}`

  const privKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privKey,
    new TextEncoder().encode(sigInput)
  )

  return `${sigInput}.${base64UrlEncode(sig)}`
}

// Encrypt push payload using aes128gcm (RFC 8291)
async function encryptPayload(
  payload: string,
  p256dh: string,
  auth: string
): Promise<{ ciphertext: ArrayBuffer; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const encoder = new TextEncoder()

  // Decode subscriber keys
  const subscriberPublicKey = base64UrlDecode(p256dh)
  const subscriberAuth = base64UrlDecode(auth)

  // Generate ephemeral server key pair (P-256)
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey', 'deriveBits']
  )

  // Export server public key as raw bytes (65 bytes uncompressed point)
  const serverPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
  )

  // Import subscriber's public key for ECDH
  const subscriberKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Derive shared secret via ECDH
  const sharedSecretBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberKey },
    serverKeyPair.privateKey,
    256
  )

  // Generate random 16-byte salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // HKDF to derive PRK using auth secret
  const authKey = await crypto.subtle.importKey('raw', subscriberAuth, 'HKDF', false, ['deriveKey', 'deriveBits'])
  const prk = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: sharedSecretBits,
      info: encoder.encode('Content-Encoding: auth\0'),
    },
    authKey,
    256
  )

  // HKDF to derive CEK (16 bytes) and NONCE (12 bytes)
  const prkKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])

  // key_info = "Content-Encoding: aes128gcm\0" + 0x01
  // nonce_info = "Content-Encoding: nonce\0" + 0x01
  const buildInfo = (label: string) => {
    const info = new Uint8Array(label.length + 2)
    encoder.encodeInto(label, info)
    info[label.length] = 0x00
    info[label.length + 1] = 0x01
    return info
  }

  const cekBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: buildInfo('Content-Encoding: aes128gcm') },
    prkKey,
    128
  )
  const nonceBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: buildInfo('Content-Encoding: nonce') },
    prkKey,
    96
  )

  // Import CEK for AES-GCM
  const cek = await crypto.subtle.importKey('raw', cekBits, 'AES-GCM', false, ['encrypt'])

  // Pad the plaintext: add \x02 padding delimiter byte (RFC 8291 §4)
  const plaintextBytes = encoder.encode(payload)
  const padded = new Uint8Array(plaintextBytes.length + 1)
  padded.set(plaintextBytes)
  padded[plaintextBytes.length] = 0x02

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonceBits, tagLength: 128 },
    cek,
    padded
  )

  return { ciphertext, salt, serverPublicKey: serverPublicKeyRaw }
}

// Build the aes128gcm content-encoding header + encrypted body
function buildEncryptedBody(
  ciphertext: ArrayBuffer,
  salt: Uint8Array,
  serverPublicKey: Uint8Array
): Uint8Array {
  // Header layout (RFC 8188 §2.1):
  //   salt (16) | rs (4, big-endian uint32) | idlen (1) | keyid (idlen) | ciphertext
  const rs = 4096 // record size
  const rsBytes = new Uint8Array(4)
  new DataView(rsBytes.buffer).setUint32(0, rs, false)

  const header = new Uint8Array(
    16 + 4 + 1 + serverPublicKey.length
  )
  let offset = 0
  header.set(salt, offset); offset += 16
  header.set(rsBytes, offset); offset += 4
  header[offset] = serverPublicKey.length; offset += 1
  header.set(serverPublicKey, offset)

  const ct = new Uint8Array(ciphertext)
  const body = new Uint8Array(header.length + ct.length)
  body.set(header)
  body.set(ct, header.length)
  return body
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const body = await req.json()
    const { subscriptions, title, body: msgBody, url, tag } = body as {
      subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>
      title: string
      body: string
      url?: string
      tag?: string
    }

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, skipped: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch VAPID config from org_settings
    const { data: settings } = await supabase
      .from('org_settings')
      .select('vapid_public_key, vapid_private_key, vapid_subject')
      .limit(1)
      .single()

    if (!settings?.vapid_public_key || !settings?.vapid_private_key || !settings?.vapid_subject) {
      return new Response(
        JSON.stringify({ error: 'VAPID keys not configured in org settings' }),
        { status: 422, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse VAPID private key — stored as base64url-encoded raw P-256 private key bytes
    // Convert raw key to JWK format for Web Crypto
    const privateKeyBytes = base64UrlDecode(settings.vapid_private_key)
    const publicKeyBytes = base64UrlDecode(settings.vapid_public_key)

    // P-256 uncompressed point: 0x04 + x (32 bytes) + y (32 bytes)
    const x = base64UrlEncode(publicKeyBytes.slice(1, 33))
    const y = base64UrlEncode(publicKeyBytes.slice(33, 65))
    const d = base64UrlEncode(privateKeyBytes)

    const privateKeyJwk: JsonWebKey = {
      kty: 'EC', crv: 'P-256', d, x, y,
    }

    const payloadJson = JSON.stringify({
      title,
      body: msgBody,
      url: url || '/volunteer/home',
      tag: tag || 'medvolunteer',
    })

    let sent = 0
    let failed = 0
    const expired: string[] = []

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const endpointUrl = new URL(sub.endpoint)
          const audience = `${endpointUrl.protocol}//${endpointUrl.host}`

          const jwt = await buildVapidJwt(audience, settings.vapid_subject, privateKeyJwk)
          const vapidPublicKeyB64 = base64UrlEncode(publicKeyBytes)

          const { ciphertext, salt, serverPublicKey } = await encryptPayload(
            payloadJson,
            sub.p256dh,
            sub.auth
          )
          const encBody = buildEncryptedBody(ciphertext, salt, serverPublicKey)

          const response = await fetch(sub.endpoint, {
            method: 'POST',
            headers: {
              Authorization: `vapid t=${jwt},k=${vapidPublicKeyB64}`,
              'Content-Type': 'application/octet-stream',
              'Content-Encoding': 'aes128gcm',
              TTL: '86400',
            },
            body: encBody,
          })

          if (response.status === 201 || response.status === 200) {
            sent++
          } else if (response.status === 404 || response.status === 410) {
            // Subscription expired / unsubscribed
            expired.push(sub.endpoint)
            failed++
          } else {
            const text = await response.text()
            console.error(`[send-push] Push failed ${response.status}: ${text}`)
            failed++
          }
        } catch (err) {
          console.error('[send-push] Error sending to', sub.endpoint, err)
          failed++
        }
      })
    )

    // Clean up expired subscriptions
    if (expired.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expired)
    }

    return new Response(
      JSON.stringify({ sent, failed, expired: expired.length }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[send-push] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
