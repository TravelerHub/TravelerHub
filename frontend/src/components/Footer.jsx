import { Link } from "react-router-dom";

function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={{ background: "#160f29", borderTop: "1px solid #374151" }}>
      <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">

        {/* Brand */}
        <p className="text-sm font-semibold" style={{ color: "#fbfbf2" }}>
          TravelHub
        </p>

        {/* Links */}
        <nav className="flex items-center gap-6">
          {[
            { to: "/about",     label: "About"      },
            { to: "/service",   label: "Services"   },
            { to: "/feedback",  label: "Feedback"   },
            { to: "/contactus", label: "Contact"    },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-sm transition hover:opacity-100"
              style={{ color: "#5c6b73" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fbfbf2")}
              onMouseLeave={e => (e.currentTarget.style.color = "#5c6b73")}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Copyright */}
        <p className="text-xs" style={{ color: "#5c6b73" }}>
          © {currentYear} TravelHub
        </p>

      </div>
    </footer>
  );
}

export default Footer;
