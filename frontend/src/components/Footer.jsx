import { Link } from "react-router-dom";

function Footer() {
  //const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-white">
      <div className="w-screen px-6 py-6">
        {/* Main Footer Content */}
        <div className="flex justify-between gap-6 mb-8">
          <Link
            to="/about"
            className="bg-gray-600 hover:bg-gray-700 !text-white font-semibold py-2 px-6 rounded transition"
          >
            About
          </Link>
          <Link
            to="/contactus"
            className="bg-gray-600 hover:bg-gray-700 !text-white font-semibold py-2 px-6 rounded transition"
          >
            Contact Us
          </Link>
          <Link
            to="/feedback"
            className="bg-gray-600 hover:bg-gray-700 !text-white font-semibold py-2 px-6 rounded transition"
          >
            Feedback
          </Link>
          <Link
            to="/service"
            className="bg-gray-600 hover:bg-gray-700 !text-white font-semibold py-2 px-6 rounded transition"
          >
            Service
          </Link>
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
