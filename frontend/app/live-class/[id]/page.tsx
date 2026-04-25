import dynamic from "next/dynamic";

const LiveClassPage = dynamic(() => import("./LiveClassComponent.tsx"), { ssr: false });

export default LiveClassPage;
