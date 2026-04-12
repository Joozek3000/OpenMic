import { MapEntityPage } from "@/components/map-entity-page"

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MapEntityPage entityType="event" id={id} />
}
