import { Link } from "react-router-dom";

function Footer() {
  //const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="w-screen px-6 py-6">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8 justify-items-center">
          {/* Brand Section */}
          {/* <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-2xl">🌍</div>
              <span className="text-xl font-bold text-white">TravelerHub</span>
            </div>
          </div> */}

          {/* About Us */}
          <div className="">
            <h3 className="text-lg font-semibold text-white mb-4">About Us</h3>
            {/* <ul className="space-y-2">
              <li>
                <Link
                  to="/about"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  About Us
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Our Mission
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Team
                </a>
              </li>
            </ul> */}
          </div>

          {/* Services */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Services</h3>
            {/* <ul className="space-y-2">
              <li>
                <Link
                  to="/service"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Services
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Trip Planning
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Travel Guides
                </a>
              </li>
            </ul> */}
          </div>

          {/* Support */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Support</h3>
            {/* <ul className="space-y-2">
              <li>
                <Link
                  to="/feedback"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Feedback
                </Link>
              </li>
              <li>
                <Link
                  to="/contactus"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Contact Us
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  FAQ
                </a>
              </li>
            </ul> */}
          </div>

          {/* Home */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-4">Quick Links</h3>
            {/* <ul className="space-y-2">
              <li>
                <Link
                  to="/"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Dashboard
                </Link>
              </li>
              <li>
                <a
                  href="#"
                  className="text-gray-400 hover:text-indigo-400 transition font-medium"
                >
                  Sitemap
                </a>
              </li>
            </ul> */}
          </div>
        </div>

        {/* Divider */}
        {/* <div className="border-t border-gray-700 my-8"></div> */}

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Copyright */}
          {/* <p className="text-gray-400 text-sm text-center md:text-left mb-4 md:mb-0">
            &copy; {currentYear} TravelerHub. All rights reserved.
          </p> */}

          {/* Links */}
          {/* <div className="flex gap-6 text-sm">
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition font-medium"
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition font-medium"
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition font-medium"
            >
              Cookie Policy
            </a>
          </div> */}

          {/* Social Media Icons (Optional) */}
          {/* <div className="flex gap-4 mt-4 md:mt-0">
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition text-xl"
              title="Facebook"
            >
              f
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition text-xl"
              title="Twitter"
            >
              𝕏
            </a>
            <a
              href="#"
              className="text-gray-400 hover:text-indigo-400 transition text-xl"
              title="Instagram"
            >
              📷
            </a>
          </div> */}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
