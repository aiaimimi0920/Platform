import {
  renderArbitrationsWorkspace,
  type ArbitrationsPageProps,
} from "@/app/arbitrations/page";

export default async function MyArbitrationsPage({ searchParams }: ArbitrationsPageProps) {
  return renderArbitrationsWorkspace({
    ownerOnly: true,
    routePath: "/my-arbitrations",
    searchParams,
  });
}
