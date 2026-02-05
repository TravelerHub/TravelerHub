import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar_Dashboard from "../../components/navbar/Navbar_dashboard.jsx";

const SAMPLE_BOOKINGS = [
  {
    id: "b1",
    type: "Flight",
    title: "United Airlines UA 1234",
    subtitle: "LAX → SFO",
    date: "2026-02-10",
    status: "confirmed",
    price: 189.99,
  },
  {
    id: "b2",
    type: "Hotel",
    title: "Marriott Downtown",
    subtitle: "2 nights • King room",
    date: "2026-02-10",
    status: "confirmed",
    price: 420.0,
  },
  {
    id: "b3",
    type: "Ride",
    title: "Airport Pickup",
    subtitle: "SFO → Hotel",
    date: "2026-02-10",
    status: "pending",
    price: 35.5,
  },
];

const TYPE_TABS = ["All", "Flight", "Hotel", "Ride"];

function StatusPill({ status }) {
  const map = {
    confirmed: "bg-green-50 text-green-700 border-green-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
        map[status] || "bg-gray-50 text-gray-700 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

function TypeBadge({ type }) {
  const map = {
    Flight: "bg-blue-50 text-blue-700 border-blue-200",
    Hotel: "bg-purple-50 text-purple-700 border-purple-200",
    Ride: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
        map[type] || "bg-gray-50 text-gray-700 border-gray-200"
      }`}
    >
      {type}
    </span>
  );
}

export default function Booking() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("All");
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState(SAMPLE_BOOKINGS);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return bookings
      .filter((b) => (activeTab === "All" ? true : b.type === activeTab))
      .filter((b) => {
        if (!q) return true;
        return (
          b.title.toLowerCase().includes(q) ||
          b.subtitle.toLowerCase().includes(q) ||
          b.type.toLowerCase().includes(q) ||
          b.status.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }, [bookings, activeTab, query]);

  const handleCancel = (id) => {
    setBookings((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: "cancelled" } : b))
    );
  };

  return (
    <div className="min-h-screen w-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100">
      <Navbar_Dashboard />

      <div className="w-full max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Keep all your travel reservations organized in one place.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-white transition"
            >
              Back
            </button>

            <button
              onClick={() => navigate("/bookings/new")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
            >
              + Add Booking
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            {/* Tabs */}
            <div className="flex flex-wrap gap-2">
              {TYPE_TABS.map((tab) => {
                const active = tab === activeTab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {tab === "All" ? "All" : `${tab}s`}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="w-full md:w-80">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bookings..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>
          </div>
        </div>

        {/* List */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 text-center">
              <div className="text-4xl mb-3">🧳</div>
              <p className="text-gray-800 font-semibold">No bookings found</p>
              <p className="text-gray-500 text-sm mt-1">
                Try changing filters or add your first booking.
              </p>

              <button
                onClick={() => navigate("/bookings/new")}
                className="mt-5 inline-flex items-center px-5 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition"
              >
                + Add Booking
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((b) => (
                <div
                  key={b.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <TypeBadge type={b.type} />
                        <StatusPill status={b.status} />
                        <span className="text-xs text-gray-400">
                          {new Date(b.date).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 className="mt-2 text-lg font-semibold text-gray-900">
                        {b.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{b.subtitle}</p>

                      <p className="text-sm text-gray-700 mt-3">
                        <span className="text-gray-500">Cost:</span>{" "}
                        <span className="font-semibold">
                          ${Number(b.price).toFixed(2)}
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-2 sm:flex-col sm:items-stretch sm:w-40">
                      <button
                        onClick={() => navigate(`/bookings/${b.id}`)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                      >
                        View
                      </button>

                      <button
                        onClick={() => navigate(`/bookings/${b.id}/edit`)}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
                      >
                        Edit
                      </button>

                      <button
                        disabled={b.status === "cancelled"}
                        onClick={() => handleCancel(b.id)}
                        className={`px-3 py-2 rounded-lg font-medium transition ${
                          b.status === "cancelled"
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                        }`}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Hint */}
        <p className="text-xs text-gray-500 mt-6">
          Tip: Later you can connect this page to your backend and replace the
          sample bookings with API data.
        </p>
      </div>
    </div>
  );
}
