'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function HomePage() {
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'student' | 'instructor' | 'admin' | null>(null);

  const handleRoleSelect = (role: 'student' | 'instructor' | 'admin') => {
    setSelectedRole(role);
    setShowRoleModal(false);

    // Redirect to appropriate login page
    const loginPaths = {
      student: '/login',
      instructor: '/instructor/login',
      admin: '/admin/login',
    };
    
    window.location.href = loginPaths[role];
  };

  return (
    <>
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        {/* Gradient circles */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute top-0 -right-4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 border-b border-white/10 bg-white/5 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-xl group-hover:shadow-lg transition-all duration-300 transform group-hover:scale-105">
                L
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                LMS Platform
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowRoleModal(true)}
                className="relative w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-110 cursor-pointer"
                title="User menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Role Selection Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Select Your Role</h2>
              <p className="text-slate-600 mt-2">Choose how you want to access the LMS</p>
            </div>

            <div className="space-y-4">
              {/* Student Option */}
              <button
                onClick={() => handleRoleSelect('student')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747S17.5 6.253 12 6.253z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Student</h3>
                    <p className="text-sm text-slate-600">Learn and take courses</p>
                  </div>
                </div>
              </button>

              {/* Instructor Option */}
              <button
                onClick={() => handleRoleSelect('instructor')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.581m0 0H9m0 0h5.581m0 0a2.5 2.5 0 110-5h.581m-.581 5a2.5 2.5 0 110-5h.581m0 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Instructor</h3>
                    <p className="text-sm text-slate-600">Create and teach courses</p>
                  </div>
                </div>
              </button>

              {/* Admin Option */}
              <button
                onClick={() => handleRoleSelect('admin')}
                className="w-full p-4 border-2 border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">Administrator</h3>
                    <p className="text-sm text-slate-600">Manage platform and users</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200">
              <p className="text-center text-sm text-slate-600 mb-4">
                Don't have an account? Create one below:
              </p>
              <div className="flex gap-3">
                <Link
                  href="/register"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all duration-200 text-center"
                >
                  Student
                </Link>
                <Link
                  href="/instructor/register"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all duration-200 text-center"
                >
                  Instructor
                </Link>
                <Link
                  href="/admin/register"
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all duration-200 text-center"
                >
                  Admin
                </Link>
              </div>
            </div>

            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full mt-4 py-2 text-slate-600 hover:text-slate-900 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative min-h-screen flex items-center justify-center pt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left - Text Content */}
            <div className="space-y-8 animate-slide-up">
              <div className="space-y-4">
                <div className="inline-block">
                  <span className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 to-purple-100 text-transparent bg-clip-text text-sm font-semibold">
                    Welcome to Modern Learning
                  </span>
                </div>

                <h1 className="text-5xl sm:text-6xl lg:text-7xl font-display font-bold leading-tight text-slate-900">
                  Learn, Teach, and{' '}
                  <span className="text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                    Grow Together
                  </span>
                </h1>

                <p className="text-lg sm:text-xl text-slate-600 max-w-xl leading-relaxed">
                  A modern, professional learning management platform designed for organizations, instructors, and learners. Start your educational journey today.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={() => setShowRoleModal(true)}
                  className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-xl hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105 group"
                >
                  Get Started
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowRoleModal(true)}
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 transition-all duration-300 group"
                >
                  Sign In
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Features List */}
              <div className="grid grid-cols-2 gap-4 pt-8">
                {[
                  { icon: '📚', label: 'Courses' },
                  { icon: '👥', label: 'Collaboration' },
                  { icon: '📊', label: 'Analytics' },
                  { icon: '🎖️', label: 'Certificates' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-slate-700">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Animated Illustration */}
            <div className="relative h-96 lg:h-auto flex items-center justify-center">
              <div className="relative w-80 h-96">
                {/* Book pages flip animation */}
                <div className="absolute inset-0 perspective">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-xl shadow-2xl"
                      style={{
                        animation: `flipBook ${2 + i * 0.5}s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
                        transform: `translateX(${i * 8}px) scale(${1 - i * 0.05})`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-center">
                          <p className="text-4xl mb-2">
                            {['📖', '✏️', '🎓'][i]}
                          </p>
                          <p className="font-semibold text-sm opacity-80">
                            {['Learn', 'Create', 'Achieve'][i]}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Floating elements */}
                <div className="absolute -top-6 -right-6 w-20 h-20 bg-yellow-300 rounded-full opacity-30 animate-float" />
                <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-pink-300 rounded-full opacity-20 animate-float" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Why Choose Our LMS?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Everything you need to create, manage, and deliver world-class learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: '🎯',
                title: 'Intuitive Interface',
                description: 'User-friendly design that requires minimal training for students and instructors.',
              },
              {
                icon: '📱',
                title: 'Responsive Design',
                description: 'Learn seamlessly across desktop, tablet, and mobile devices.',
              },
              {
                icon: '🔒',
                title: 'Secure & Reliable',
                description: 'Enterprise-grade security with multi-tenant architecture.',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="modern-card p-8 text-center hover:scale-105 transition-transform duration-300"
              >
                <p className="text-5xl mb-4">{item.icon}</p>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50/50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Resources', links: ['Documentation', 'API', 'Support'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Contact'] },
            ].map((col, idx) => (
              <div key={idx}>
                <h4 className="font-semibold text-slate-900 mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link, lidx) => (
                    <li key={lidx}>
                      <a href="#" className="text-slate-600 hover:text-blue-600 transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between">
            <p className="text-slate-600 text-sm">
              © 2026 LMS Platform. All rights reserved.
            </p>
            <div className="flex gap-4 mt-4 sm:mt-0">
              {['Twitter', 'GitHub', 'LinkedIn'].map((social, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="text-slate-600 hover:text-blue-600 transition-colors text-sm font-medium"
                >
                  {social}
                </a>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        @keyframes slideUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes flipBook {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(90deg); }
          100% { transform: rotateY(0deg); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-slide-up {
          animation: slideUp 0.6s ease-out;
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </>
  );
}
