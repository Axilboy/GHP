import { allRooms } from '../roomStore.js';
import { scheduleRoomSnapshot } from '../roomPersistence.js';
import { allProfiles } from '../profileStore.js';
import { scheduleProfileSnapshot } from '../profilePersistence.js';

export function persistProfiles() {
  scheduleProfileSnapshot(allProfiles);
}

export function persistRooms() {
  scheduleRoomSnapshot(allRooms);
}
