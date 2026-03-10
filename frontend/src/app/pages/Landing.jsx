import { useNavigate } from "react-router-dom";
import Navbar_Landing from "../../components/navbar/Navbar_landing";
import Footer from "../../components/Footer";

// import the image for the hero section
import HeroImgage from "../../assets/images/homepage_img.jpg";
import LandingImg1 from "../../assets/images/travelPic1.jpg";
import LandingImg2 from "../../assets/images/travelPic2.jpg";
import LandingImg3 from "../../assets/images/travelPic7.jpg";
import LandingImg4 from "../../assets/images/travelPic4.jpg";
import LandingImg5 from "../../assets/images/travelPic5.jpg"; 
import LandingImg6 from "../../assets/images/travelPic6.jpg";

function Landing() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <Navbar_Landing />

      {/* Main Content */}
      <main className="flex flex-col">
        {/* Hero Section */}
        <section
          className="relative min-h-[85vh] flex items-center justify-center text-white px-4"
          style={{
            backgroundImage: `url(${HeroImgage})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {/* overlay */}
          <div className="absolute inset-0 bg-black/45" />

          <div className="relative max-w-6xl w-full mx-auto">
            <h1 className="landing-header text-right">Go Where</h1>
            <h1 className="landing-header text-right">You Choose!</h1>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => navigate("/signup")}
                className="px-6 py-3 rounded-xl bg-white/90 text-black font-semibold hover:bg-white transition"
              >
                Start Planning
              </button>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className="bg-black text-white">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-20 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Your trips, organized — without the chaos.
              </h2>
              <p className="mt-5 text-white/80 leading-relaxed">
                Plan trips with friends, keep everyone on the same page, and turn
                ideas into a real itinerary. From choosing destinations to
                building a day-by-day plan, we make travel planning feel simple.
              </p>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl bg-white/10 p-5 border border-white/10">
                  <p className="font-semibold">Create itineraries</p>
                  <p className="text-sm text-white/70 mt-2">
                    Build a schedule that actually makes sense.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-5 border border-white/10">
                  <p className="font-semibold">Plan with groups</p>
                  <p className="text-sm text-white/70 mt-2">
                    Decide together, faster — less group chat scrolling.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-5 border border-white/10">
                  <p className="font-semibold">Keep it all in one place</p>
                  <p className="text-sm text-white/70 mt-2">
                    Notes, ideas, and plans stay organized.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 p-5 border border-white/10">
                  <p className="font-semibold">Travel your way</p>
                  <p className="text-sm text-white/70 mt-2">
                    You choose the vibe — we help you make it happen.
                  </p>
                </div>
              </div>
            </div>

            {/* Right side image card */}
            <div className="relative rounded-3xl overflow-hidden shadow-lg border border-white/10">
              <img
                src={LandingImg2}
                alt="Travel preview"
                className="w-full h-[360px] object-cover"
              />
              <div className="absolute inset-0 bg-black/25" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-lg font-semibold">
                  Build memories, not spreadsheets.
                </p>
                <p className="text-white/80 text-sm mt-1">
                  A clean, simple space to plan the trip you actually want.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quote Band */}
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 py-14">
            <div className="rounded-3xl bg-black text-white p-10 md:p-12 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/0 to-white/0" />
              <p className="text-white/70 text-sm tracking-wide uppercase">
                Travel quote
              </p>
              <p className="mt-4 text-2xl md:text-3xl font-bold leading-snug">
                “Collect moments, not things.”
              </p>
              <p className="mt-4 text-white/75 max-w-3xl">
                Your next adventure doesn’t start at the airport — it starts with
                a plan. Our app helps you turn inspiration into a trip everyone
                can enjoy.
              </p>
            </div>
          </div>
        </section>

        {/* Photo Grid Section */}
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 pb-16 md:pb-20">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-black">
                  Find your next vibe
                </h2>
                <p className="mt-3 text-black/70 max-w-2xl">
                  Beaches, cities, mountains — whatever you’re into, start with
                  inspiration and turn it into a plan.
                </p>
              </div>

              <button
                onClick={() => navigate("/login")}
                className="hidden md:inline-flex px-6 py-3 rounded-xl bg-black text-white font-semibold hover:bg-black/90 transition"
              >
                Continue
              </button>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
  {[
    { title: "Coastal escapes", tag: "Sun + water", image: LandingImg3 },
    { title: "City nights", tag: "Food + lights", image: LandingImg1},
    { title: "Mountain mornings", tag: "Hikes + views", image: LandingImg5 },
    { title: "Hidden gems", tag: "Local favorites", image: LandingImg6 },
    { title: "Weekend getaways", tag: "Quick reset", image: LandingImg2 },
    { title: "Big adventures", tag: "Go all in", image: LandingImg4  },
  ].map((card, idx) => (
    <div
      key={idx}
      className="group rounded-3xl overflow-hidden border border-black/10 shadow-sm hover:shadow-md transition bg-white"
    >
      <div className="relative h-56">
        <img
          src={card.image}
          alt={card.title}
          className="w-full h-full object-cover group-hover:scale-[1.02] transition"
        />
        <div className="absolute inset-0 bg-black/20" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white font-semibold text-xl">
            {card.title}
          </p>
          <p className="text-white/80 text-sm mt-1">
            {card.tag}
          </p>
        </div>
      </div>
    </div>
  ))}
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