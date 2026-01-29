import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center bg-black text-white px-4">
          <div className="max-w-6xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Welcome to TravelHub!
            </h1>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
