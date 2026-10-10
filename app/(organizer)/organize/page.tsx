/**
 * Prompt 16: list events the signed-in account staffs.
 * 1. Callers: /organize navigation
 * 2. Glob: no prior organize/page.tsx
 * 3. Sample list: [{ id: "evt_demo", name: "Nationals", roles: ["organizer"] }]
 * 4. User: "ok let do Prompt 16"
 */
import { listStaffedEvents, requireOrganizeLayoutAccess } from '@/lib/organize/access'
import OrganizeEntryCard from '@/components/organizer/OrganizeEntryCard'

export default async function OrganizeHomePage() {
  const { userId, supabaseAdmin, member } = await requireOrganizeLayoutAccess()
  const events = await listStaffedEvents(supabaseAdmin, userId)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold">Events you staff</h1>
        <p className="text-muted-foreground mt-1">
          Ops for events where you have a staff role
          {member.role === 'admin'
            ? ' (admins also use /admin for full control)'
            : ''}
          .
        </p>
      </div>

      {events.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center border rounded-lg">
          No staff assignments yet. Ask an event owner to grant you a role.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <OrganizeEntryCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
