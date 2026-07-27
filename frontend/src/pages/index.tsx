import Head from "next/head";
import { ChatWindow } from "@/components/ChatWindow";

export default function Home() {
  return (
    <>
      <Head>
        <title>SecureShip - Shipment Support Chat</title>
        <meta name="description" content="AI-gated shipment support chat" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <ChatWindow />
    </>
  );
}
