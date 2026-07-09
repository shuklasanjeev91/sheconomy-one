import { ParticipantTile, type ParticipantTileProps } from '@livekit/components-react'

/** Branded LiveKit participant tile — styled via sheconomy-participant-tile CSS. */
export function SheconomyParticipantTile(props: ParticipantTileProps) {
  return <ParticipantTile className="sheconomy-participant-tile" {...props} />
}