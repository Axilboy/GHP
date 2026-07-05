import { Storefront } from '../RoadmapPanels';
import { Header, SubscriptionBadge } from '../shared/Header';

export function StoreScreen({ navigate, profile, setProfile, catalog }) {
  return <main className="app-screen store-partyhub-page">
    <Header navigate={navigate} brandTheme="partyhub" right={<SubscriptionBadge profile={profile} />} />
    <Storefront profile={profile} setProfile={setProfile} catalog={catalog} navigate={navigate} />
  </main>;
}
