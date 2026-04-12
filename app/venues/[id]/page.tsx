import { MapEntityPage } from "@/components/map-entity-page"

export default async function VenuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MapEntityPage entityType="venue" id={id} />
}
