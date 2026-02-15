import Header from '@/components/Header';
import ChatInterface from '@/components/ChatInterface';
import PortfolioDashboard from '@/components/PortfolioDashboard';

export default function Home() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Header />
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Chat Interface */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-border flex flex-col min-w-0">
          <ChatInterface />
        </div>

        {/* Right: Portfolio Dashboard */}
        <div className="w-full lg:w-1/2 h-1/2 lg:h-full flex flex-col min-w-0 bg-background">
          <PortfolioDashboard />
        </div>
      </main>
    </div>
  );
}
