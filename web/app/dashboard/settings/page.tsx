import { createAdminClient } from '@/lib/supabase/admin'
import { unstable_noStore as noStore } from 'next/cache'
import SettingsView from './SettingsView'
import type { Organization, Location, OrgTag, OrgFlag, OrgHoliday, FormAutomationRule, AutoMessageRule, MessageTemplate, CategoryRequirement, CategoryCoordinator, DocumentAutomationRule, Category } from '@/types/database'

export const dynamic = 'force-dynamic'

async function fetchData() {
  noStore()
  const supabase = createAdminClient()

  const [{ data: org }, { data: locations }, { data: tags }, { data: flags }, { data: holidays }, { data: automationRules }, { data: autoMsgRules }, { data: templates }, { data: catReqs }, { data: coordinators }, { data: activeVols }, { data: docRules }, { data: categoriesData }] = await Promise.all([
    supabase.from('organizations').select('*').limit(1).single(),
    supabase.from('locations').select('*').order('created_at', { ascending: true }),
    supabase.from('org_tags').select('*').order('name'),
    supabase.from('org_flags').select('*').order('name'),
    supabase.from('org_holidays').select('*').order('date', { ascending: true }),
    supabase.from('form_automation_rules').select('*').order('created_at', { ascending: true }),
    supabase.from('auto_message_rules').select('*').order('created_at', { ascending: true }),
    supabase.from('message_templates').select('id, name, subject, channel').order('name', { ascending: true }),
    supabase.from('category_requirements').select('*').order('category_name').order('created_at'),
    supabase.from('org_category_coordinators').select('*'),
    supabase.from('volunteers').select('id, first_name, last_name').eq('status', 'volunteer').order('first_name', { ascending: true }),
    supabase.from('document_automation_rules').select('*').order('created_at', { ascending: true }),
    supabase.from('categories').select('*').order('sort_order'),
  ])

  return {
    org: org as Organization | null,
    locations: (locations ?? []) as Location[],
    tags: (tags ?? []) as OrgTag[],
    flags: (flags ?? []) as OrgFlag[],
    holidays: (holidays ?? []) as OrgHoliday[],
    automationRules: (automationRules ?? []) as FormAutomationRule[],
    autoMessageRules: (autoMsgRules ?? []) as AutoMessageRule[],
    messageTemplates: (templates ?? []) as Pick<MessageTemplate, 'id' | 'name' | 'subject' | 'channel'>[],
    categoryRequirements: (catReqs ?? []) as CategoryRequirement[],
    categoryCoordinators: (coordinators ?? []) as CategoryCoordinator[],
    activeVolunteers: (activeVols ?? []) as { id: string; first_name: string; last_name: string }[],
    documentAutomationRules: (docRules ?? []) as DocumentAutomationRule[],
    categories: (categoriesData ?? []) as Category[],
  }
}

export default async function SettingsPage() {
  const { org, locations, tags, flags, holidays, automationRules, autoMessageRules, messageTemplates, categoryRequirements, categoryCoordinators, activeVolunteers, documentAutomationRules, categories } = await fetchData()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        padding: '28px 32px 20px',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
        flexShrink: 0,
      }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#111827', marginBottom: '2px' }}>
          Settings
        </h1>
        <p style={{ fontSize: '13px', color: '#9ca3af' }}>
          Manage your organization, locations, integrations, tags, and flags
        </p>
      </div>

      <SettingsView
        org={org}
        locations={locations}
        initialTags={tags}
        initialFlags={flags}
        initialHolidays={holidays}
        initialAutomationRules={automationRules}
        initialAutoMessageRules={autoMessageRules}
        messageTemplates={messageTemplates}
        initialCategoryRequirements={categoryRequirements}
        initialCoordinators={categoryCoordinators}
        activeVolunteers={activeVolunteers}
        initialDocRules={documentAutomationRules}
        categories={categories}
      />
    </div>
  )
}
