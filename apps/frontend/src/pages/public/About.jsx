import {
  Target,
  Users,
  Award,
  TrendingUp,
  BookOpen,
  Shield,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { getPublicStats } from "../../shared/lib/dataService";

export default function About() {
  const [stats, setStats] = useState([
    { value: "0", label: "Students" },
    { value: "0", label: "Tests" },
    { value: "0", label: "Exams Covered" },
    { value: "N/A", label: "Satisfaction" },
  ]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchStats = async () => {
      try {
        const stats = await getPublicStats();
        if (controller.signal.aborted) return;
        if (stats) {
          setStats([
            { value: stats.activeLearners || 0, label: "Students" },
            { value: stats.mockTests || 0, label: "Tests" },
            { value: stats.examsCovered || 0, label: "Exams Covered" },
            {
              value: stats.satisfaction ? `${stats.satisfaction}%` : "N/A",
              label: "Satisfaction",
            },
          ]);
        }
      } catch (error) {
        if (error.name === "AbortError" || controller.signal.aborted) return;
        console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();
    return () => controller.abort();
  }, []);

  const features = [
    {
      icon: Target,
      title: "Comprehensive Tests",
      desc: "Extensive question bank covering all competitive exams",
    },
    {
      icon: Users,
      title: "Expert Faculty",
      desc: "Learn from experienced educators and subject experts",
    },
    {
      icon: Award,
      title: "Proven Results",
      desc: "Thousands of students cleared competitive exams",
    },
    {
      icon: TrendingUp,
      title: "Performance Tracking",
      desc: "Detailed analytics to monitor your progress",
    },
    {
      icon: BookOpen,
      title: "Study Materials",
      desc: "Quality notes and resources for all subjects",
    },
    {
      icon: Shield,
      title: "Secure Platform",
      desc: "Safe and reliable testing environment",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet>
        <title>About Us | Trstprep</title>
        <meta
          name="description"
          content="Learn about Trstprep - your trusted companion for competitive exam preparation with mock tests and study materials."
        />
        <meta property="og:title" content="About Us | Trstprep" />
        <meta
          property="og:description"
          content="Learn about Trstprep - your trusted companion for competitive exam preparation."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="/og-image.png" />
      </Helmet>
      {/* Hero */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 text-white py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl md:text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            About Trstprep
          </h1>
          <p className="text-xl text-indigo-100 max-w-[95vw] sm:max-w-2xl mx-auto">
            Your trusted companion for competitive exam preparation
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="py-12 bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center">
                <div className="text-xl sm:text-2xl lg:text-3xl md:text-2xl sm:text-3xl lg:text-4xl font-bold text-indigo-600">
                  {stat.value}
                </div>
                <div className="text-gray-600 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-8">
            Our Mission
          </h2>
          <p className="text-lg text-gray-600 text-center leading-relaxed">
            We are dedicated to making quality education accessible to every
            student preparing for competitive exams. Our platform combines
            innovative technology with expert pedagogy to deliver the best
            learning experience. Whether you're preparing for SSC, Banking,
            Railway, or any other competitive exam, Trstprep is here to guide
            you to success.
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 text-center mb-12">
            Why Choose Trstprep?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="p-6 bg-gray-50 rounded-xl hover:shadow-lg transition-shadow"
              >
                <feature.icon className="w-12 h-12 text-indigo-600 mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h3>
                <p className="text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="py-16 bg-indigo-600">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4">
            Start Your Journey Today
          </h2>
          <p className="text-indigo-100 mb-8 text-lg">
            Join thousands of successful students
          </p>
          <a
            href="/signup"
            className="inline-block px-8 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Get Started Free
          </a>
        </div>
      </div>
    </div>
  );
}
