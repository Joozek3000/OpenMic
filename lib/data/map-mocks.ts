import { Timestamp } from "firebase/firestore"

import type { MapEntity } from "@/lib/types"

const now = Date.now()

function daysFromNow(days: number) {
  return Timestamp.fromMillis(now + days * 24 * 60 * 60 * 1000)
}

export const MOCK_MAP_ENTITIES: MapEntity[] = [
  // Tweak these coordinates/titles when demoing a different city.
  {
    id: "mock-event-camden-friday",
    entityType: "event",
    title: "Friday Night Laughs",
    description: "Fast-paced open mic with pro drop-ins.",
    venueId: "mock-venue-camden-cellar",
    startTime: daysFromNow(1),
    endTime: daysFromNow(1.25),
    lineup: ["mock-comedian-alex-rivera", "mock-comedian-priya-shah"],
    ticketUrl: "https://example.com/tickets/friday-night-laughs",
    isFree: false,
    comedyType: "standup",
    geoLocation: { lat: 51.5416, lng: -0.1432 },
  },
  {
    id: "mock-event-shoreditch-sunday",
    entityType: "event",
    title: "Sunday Roast Comedy",
    description: "Crowd work heavy showcase and new material.",
    venueId: "mock-venue-shoreditch-spot",
    startTime: daysFromNow(3),
    endTime: daysFromNow(3.2),
    lineup: ["mock-comedian-joel-khan", "mock-comedian-priya-shah"],
    ticketUrl: "https://example.com/tickets/sunday-roast-comedy",
    isFree: true,
    comedyType: "crowdwork",
    geoLocation: { lat: 51.5256, lng: -0.0794 },
  },
  {
    id: "mock-event-soho-midweek",
    entityType: "event",
    title: "Midweek Mic Lab",
    description: "Try 5 fresh minutes and workshop tags.",
    venueId: "mock-venue-soho-room",
    startTime: daysFromNow(5),
    lineup: ["mock-comedian-alex-rivera", "mock-comedian-joel-khan"],
    ticketUrl: "https://example.com/tickets/midweek-mic-lab",
    isFree: true,
    comedyType: "new-material",
    geoLocation: { lat: 51.5148, lng: -0.1323 },
  },
  {
    id: "mock-venue-camden-cellar",
    entityType: "venue",
    name: "Camden Cellar",
    description: "Basement club with low ceiling energy.",
    address: "31 Parkway, London NW1",
    tags: ["standup", "open-mic"],
    eventIds: ["mock-event-camden-friday"],
    geoLocation: { lat: 51.5392, lng: -0.1426 },
  },
  {
    id: "mock-venue-shoreditch-spot",
    entityType: "venue",
    name: "Shoreditch Spot",
    description: "Intimate room built for crowd interaction.",
    address: "54 Curtain Rd, London EC2",
    tags: ["crowdwork", "showcase"],
    eventIds: ["mock-event-shoreditch-sunday"],
    geoLocation: { lat: 51.5245, lng: -0.0821 },
  },
  {
    id: "mock-venue-soho-room",
    entityType: "venue",
    name: "Soho Back Room",
    description: "Classic late-night stand-up room.",
    address: "12 Greek St, London W1",
    tags: ["new-material", "standup"],
    eventIds: ["mock-event-soho-midweek"],
    geoLocation: { lat: 51.5136, lng: -0.1329 },
  },
  {
    id: "mock-comedian-alex-rivera",
    entityType: "comedian",
    displayName: "Alex Rivera",
    geoLocation: { lat: 51.5194, lng: -0.1045 },
  },
  {
    id: "mock-comedian-priya-shah",
    entityType: "comedian",
    displayName: "Priya Shah",
    geoLocation: { lat: 51.5333, lng: -0.1215 },
  },
  {
    id: "mock-comedian-joel-khan",
    entityType: "comedian",
    displayName: "Joel Khan",
    geoLocation: { lat: 51.5077, lng: -0.0877 },
  },
  {
    id: "mock-video-camden-set",
    entityType: "video",
    videoId: "mock-video-camden-set",
    comedianId: "mock-comedian-alex-rivera",
    venueId: "mock-venue-camden-cellar",
    title: "Airport security bit",
    timestamp: daysFromNow(-2),
    geoLocation: { lat: 51.5409, lng: -0.1464 },
  },
  {
    id: "mock-video-shoreditch-crowd",
    entityType: "video",
    videoId: "mock-video-shoreditch-crowd",
    comedianId: "mock-comedian-priya-shah",
    venueId: "mock-venue-shoreditch-spot",
    title: "Front row banter",
    timestamp: daysFromNow(-1),
    geoLocation: { lat: 51.5261, lng: -0.0789 },
  },
  {
    id: "mock-video-soho-closer",
    entityType: "video",
    videoId: "mock-video-soho-closer",
    comedianId: "mock-comedian-joel-khan",
    venueId: "mock-venue-soho-room",
    title: "Relationship closer",
    timestamp: daysFromNow(-4),
    geoLocation: { lat: 51.5138, lng: -0.1291 },
  },
]

export function getMockMapEntityById(id: string) {
  return MOCK_MAP_ENTITIES.find((entity) => entity.id === id || (entity.entityType === "video" && entity.videoId === id)) ?? null
}
