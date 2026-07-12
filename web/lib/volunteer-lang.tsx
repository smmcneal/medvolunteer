'use client'

import { createContext, useContext, useState } from 'react'

// ─── Translations ─────────────────────────────────────────────────────────────

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // Nav
    nav_home: 'Home',
    nav_shifts: 'Shifts',
    nav_docs: 'Docs',
    nav_handbook: 'Handbook',
    nav_profile: 'Profile',

    // Install banner
    install_title: 'Add to Home Screen',
    install_subtitle: 'Get the full app experience',
    install_btn: 'Install',
    ios_hint_title: 'Add to Home Screen',
    ios_hint_body: 'Share button, then choose',
    ios_hint_action: '"Add to Home Screen"',
    ios_hint_suffix: 'to install MedVolunteer.',

    // Greetings
    greeting_morning: 'Good morning',
    greeting_afternoon: 'Good afternoon',
    greeting_evening: 'Good evening',

    // Status labels
    status_volunteer: 'Volunteer',
    status_prospect: 'Prospect',
    status_applicant: 'Applicant',
    status_inactive: 'Inactive',

    // Onboarding
    onboarding_title: 'Onboarding Progress',
    onboarding_of: 'of',
    onboarding_stages_complete: 'stages complete',
    onboarding_complete: 'complete',
    onboarding_waiting: '✓ All stages complete — waiting for activation',

    // Home — upcoming shifts
    upcoming_shifts: 'Upcoming Shifts',
    no_upcoming_shifts: 'No upcoming shifts scheduled',
    check_coordinator: 'Check with your coordinator for assignments',
    view_all_shifts: 'View all shifts',

    // Clock in/out
    clock_in: 'Clock In',
    clock_out: 'Clock Out',
    active_shift: 'Active Shift',
    clocked_in_since: 'Clocked in since',
    currently_clocked_in: '● Currently clocked in',
    ready_to_start: 'Ready to start?',
    tap_to_clock: 'Tap to clock in and start tracking your hours',
    clocking_in: 'Clocking in…',
    clocking_out: 'Clocking out…',

    // Credentials expiry
    expiring_creds: '⚠ Credentials Expiring Soon',
    expires_in: 'Expires in',
    days: 'days',

    // Shifts page
    select_location: 'Select location',
    all_locations: 'All locations',
    location_prompt: 'Choose a location to see available shifts',
    shifts_title: 'My Shifts',
    no_shifts: 'No upcoming shifts',
    no_past_shifts: 'No past shifts yet',
    no_shifts_sub: 'Check back later for available shifts',
    no_past_shifts_sub: 'Completed shifts will appear here',
    shift_status_scheduled: 'Scheduled',
    shift_status_completed: 'Completed',
    shift_status_cancelled: 'Cancelled',
    shift_status_no_show: 'No Show',
    reschedule: 'Request Reschedule',
    cancel_shift: 'Cancel',
    move_shift: 'Move',
    drop_shift: 'Drop',
    my_shifts_label: 'My Shifts',
    yes_drop_shift: 'Yes, drop shift',
    keep_shift: 'Keep it',
    select_time: 'Select',
    moving: 'Moving…',
    sign_up_btn: 'Sign Up',
    signing_up: 'Signing up…',
    group_size_label: 'Bringing others? Total people',
    group_size_prefix: 'Party of',

    // Handbook
    handbook_title: 'Volunteer Handbook',
    handbook_read_carefully: 'Please read carefully before signing',
    no_handbook: 'No handbook available',

    // Documents tab
    docs_title: 'Documents',
    upload_doc: 'Upload Document',
    no_docs: 'No documents yet',
    no_docs_sub: 'Check back soon',
    forms_disclosures: 'Forms & Disclosures',
    additional_docs: 'Additional Documents',
    onboarding_checklist: 'Onboarding Checklist',
    application_submitted: 'Application Submitted',
    completed_label: 'Completed',
    pending_label: 'Pending',
    done_label: 'Done',
    doc_open: 'Open',
    doc_opening: 'Opening…',

    // Profile
    contact_info: 'Contact Information',
    email: 'Email',
    phone: 'Phone',
    emergency_contact: 'Emergency Contact',
    name: 'Name',
    edit: 'Edit',
    save: 'Save changes',
    cancel: 'Cancel',
    saving: 'Saving…',
    credentials: 'Credentials',
    credential_upload: 'Upload Credential Document',
    credential_file_types: 'PDF, Word, Excel, PNG, JPG — up to 50 MB',
    verified: 'Verified',
    language_section: 'Language / Idioma',
    sign_out: 'Sign Out',
    signing_out: 'Signing out…',
    supporting_docs: 'Supporting Documents',
    contact_updated: 'Contact info updated',
    emergency_updated: 'Emergency contact updated',
    no_credentials: 'No credentials on file',
    no_docs_profile: 'No documents on file yet',
    expired_label: 'Expired',
    member_since: 'Member since',
    email_address_label: 'Email address',
    phone_number_label: 'Phone number',
    contact_name_label: 'Contact name',
  },

  es: {
    // Nav
    nav_home: 'Inicio',
    nav_shifts: 'Turnos',
    nav_docs: 'Docs',
    nav_handbook: 'Manual',
    nav_profile: 'Perfil',

    // Install banner
    install_title: 'Agregar a pantalla de inicio',
    install_subtitle: 'Obtén la experiencia completa',
    install_btn: 'Instalar',
    ios_hint_title: 'Agregar a pantalla de inicio',
    ios_hint_body: 'botón Compartir, luego elige',
    ios_hint_action: '"Agregar a pantalla de inicio"',
    ios_hint_suffix: 'para instalar MedVolunteer.',

    // Greetings
    greeting_morning: 'Buenos días',
    greeting_afternoon: 'Buenas tardes',
    greeting_evening: 'Buenas noches',

    // Status labels
    status_volunteer: 'Voluntario',
    status_prospect: 'Prospecto',
    status_applicant: 'Solicitante',
    status_inactive: 'Inactivo',

    // Onboarding
    onboarding_title: 'Progreso de incorporación',
    onboarding_of: 'de',
    onboarding_stages_complete: 'etapas completadas',
    onboarding_complete: 'completado',
    onboarding_waiting: '✓ Todas las etapas completas — esperando activación',

    // Home — upcoming shifts
    upcoming_shifts: 'Próximos turnos',
    no_upcoming_shifts: 'Sin turnos próximos programados',
    check_coordinator: 'Consulta con tu coordinador para asignaciones',
    view_all_shifts: 'Ver todos los turnos',

    // Clock in/out
    clock_in: 'Registrar entrada',
    clock_out: 'Registrar salida',
    active_shift: 'Turno activo',
    clocked_in_since: 'Entrada registrada desde',
    currently_clocked_in: '● Entrada registrada actualmente',
    ready_to_start: '¿Listo para comenzar?',
    tap_to_clock: 'Toca para registrar entrada y comenzar a registrar tus horas',
    clocking_in: 'Registrando entrada…',
    clocking_out: 'Registrando salida…',

    // Credentials expiry
    expiring_creds: '⚠ Credenciales por vencer',
    expires_in: 'Vence en',
    days: 'días',

    // Shifts page
    select_location: 'Seleccionar ubicación',
    all_locations: 'Todas las ubicaciones',
    location_prompt: 'Elige una ubicación para ver los turnos disponibles',
    shifts_title: 'Mis turnos',
    no_shifts: 'Sin turnos próximos',
    no_past_shifts: 'Sin turnos pasados aún',
    no_shifts_sub: 'Vuelve más tarde para ver turnos disponibles',
    no_past_shifts_sub: 'Los turnos completados aparecerán aquí',
    shift_status_scheduled: 'Programado',
    shift_status_completed: 'Completado',
    shift_status_cancelled: 'Cancelado',
    shift_status_no_show: 'No asistió',
    reschedule: 'Solicitar reprogramación',
    cancel_shift: 'Cancelar',
    move_shift: 'Mover',
    drop_shift: 'Abandonar',
    my_shifts_label: 'Mis turnos',
    yes_drop_shift: 'Sí, abandonar',
    keep_shift: 'Mantener',
    select_time: 'Seleccionar',
    moving: 'Moviendo…',
    sign_up_btn: 'Inscribirse',
    signing_up: 'Inscribiendo…',
    group_size_label: '¿Traes a otras personas? Total de personas',
    group_size_prefix: 'Grupo de',

    // Handbook
    handbook_title: 'Manual del voluntario',
    handbook_read_carefully: 'Por favor lee con atención antes de firmar',
    no_handbook: 'Manual no disponible',

    // Documents tab
    docs_title: 'Documentos',
    upload_doc: 'Subir documento',
    no_docs: 'Sin documentos aún',
    no_docs_sub: 'Vuelve pronto',
    forms_disclosures: 'Formularios y divulgaciones',
    additional_docs: 'Documentos adicionales',
    onboarding_checklist: 'Lista de incorporación',
    application_submitted: 'Solicitud enviada',
    completed_label: 'Completado',
    pending_label: 'Pendiente',
    done_label: 'Listo',
    doc_open: 'Abrir',
    doc_opening: 'Abriendo…',

    // Profile
    contact_info: 'Información de contacto',
    email: 'Correo electrónico',
    phone: 'Teléfono',
    emergency_contact: 'Contacto de emergencia',
    name: 'Nombre',
    edit: 'Editar',
    save: 'Guardar cambios',
    cancel: 'Cancelar',
    saving: 'Guardando…',
    credentials: 'Credenciales',
    credential_upload: 'Subir documento de credencial',
    credential_file_types: 'PDF, Word, Excel, PNG, JPG — hasta 50 MB',
    verified: 'Verificado',
    language_section: 'Language / Idioma',
    sign_out: 'Cerrar sesión',
    signing_out: 'Cerrando sesión…',
    supporting_docs: 'Documentos de soporte',
    contact_updated: 'Información de contacto actualizada',
    emergency_updated: 'Contacto de emergencia actualizado',
    no_credentials: 'Sin credenciales en archivo',
    no_docs_profile: 'Sin documentos en archivo aún',
    expired_label: 'Vencido',
    member_since: 'Miembro desde',
    email_address_label: 'Correo electrónico',
    phone_number_label: 'Número de teléfono',
    contact_name_label: 'Nombre del contacto',
  },
}

// ─── Contexts ─────────────────────────────────────────────────────────────────

export const LangContext = createContext<string>('en')
export const SetLangContext = createContext<(lang: string) => void>(() => {})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LangProvider({
  initialLang,
  children,
}: {
  initialLang: string
  children: React.ReactNode
}) {
  const [lang, setLang] = useState(initialLang)

  return (
    <LangContext.Provider value={lang}>
      <SetLangContext.Provider value={setLang}>
        {children}
      </SetLangContext.Provider>
    </LangContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useT() {
  const lang = useContext(LangContext)
  return function t(key: string): string {
    return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['en']?.[key] ?? key
  }
}
