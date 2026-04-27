import dynamic from "next/dynamic";

const LiveClassPage = dynamic(() => import("./LiveClassComponent"), { ssr: false });

export default LiveClassPage;
