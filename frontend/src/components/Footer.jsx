import { Link } from "react-router-dom";

function Footer() {
  //const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="flex justify-center align-center w-screen px6 py-4">
        {/* Main Footer Content */}
        <div className="flex justify-in-between space-x-5 gap-6 mb-8">
          <Link to="/about" className="footer-btn">
            About Us
          </Link>

          <Link to="/service" className="footer-btn">
            Services
          </Link>

          <Link to="/feedback" className="footer-btn">
            Feedback
          </Link>

          <Link to="/contactus" className="footer-btn">
            Contact Us
          </Link>
        </div>

        
        
      </div>
    </footer>
  );
}

export default Footer;
