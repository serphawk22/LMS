import dynamic from "next/dynamic";

const LiveClassPage = dynamic(() => import("./LiveClassComponent.jsx").then(mod => mod.default), { ssr: false });

export default LiveClassPage;
