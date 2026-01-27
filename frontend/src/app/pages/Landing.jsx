import { useNavigate } from "react-router-dom";
import Navbar from "../../components/navbar/Navbar";
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
              Travel Hub
            </h1>

            <div className="mt-4 flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => navigate("/login")}
                className="border-2 border-white font-bold py-3 px-8 rounded-lg hover:bg-white text-black hover:text-indigo-600 transition"
              >
                Log In
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}

export default Landing;
