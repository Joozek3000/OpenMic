import { MapEntityPage } from "@/components/map-entity-page"

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MapEntityPage entityType="video" id={id} />
}
