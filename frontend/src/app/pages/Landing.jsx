import { useNavigate } from "react-router-dom";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

// import the image for the hero section
import HeroImgage from "../../assets/images/homepage_img.jpg";


function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <Navbar_Landing />

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Hero Section */}
        <section className="flex-1 flex items-center justify-center bg-black/10 bg-center text-white px-4"
        style={{backgroundImage: `url(${HeroImgage})`, backgroundSize: 'cover', backgroundPosition: 'center'}}>

          <div className="relative max-w-6xl w-full mx-auto">
            
            <h1 className="landing-header text-right">
              Go Where 
            </h1>
            <h1 className="landing-header text-right">
              You Choose!
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
