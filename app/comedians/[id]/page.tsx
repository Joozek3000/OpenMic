import { MapEntityPage } from "@/components/map-entity-page"

export default async function ComedianPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MapEntityPage entityType="comedian" id={id} />
}
