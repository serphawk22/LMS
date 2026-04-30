'use client';

import Link from 'next/link';
import { useState } from 'react';
import ThemeToggle from '@/components/ThemeToggle';

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
        <div className="absolute top-0 -left-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob hero-glow-1" />
        <div className="absolute top-0 -right-4 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000 hero-glow-2" />
        <div className="absolute -bottom-8 left-20 w-96 h-96 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000 hero-glow-3" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-40 border-b backdrop-blur-md hero-nav">
        <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="w-full max-w-7xl mx-auto 2xl:px-0 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg bg-[var(--primary-color)] flex items-center justify-center text-white font-bold text-xl shadow-lg">
                L
              </div>
              <span className="text-lg sm:text-xl font-bold text-[var(--text-color)] hidden sm:inline">
                LMS Platform
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <button
                onClick={() => setShowRoleModal(true)}
                className="relative w-10 h-10 rounded-full bg-[var(--secondary-color)] flex items-center justify-center text-white hover:shadow-lg hover:shadow-[var(--secondary-color)]/50 transition-all duration-300 transform hover:scale-110 cursor-pointer flex-shrink-0"
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
          <div className="w-full max-w-md rounded-2xl bg-[var(--card-color)] border border-[var(--border-color)] shadow-2xl p-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-[var(--text-color)]">Select Your Role</h2>
                <p className="text-[var(--muted-color)] mt-2">Choose how you want to access the LMS</p>
            </div>

            <div className="space-y-4">
              {/* Student Option */}
              <button
                onClick={() => handleRoleSelect('student')}
                className="w-full p-4 border-2 rounded-xl border-[var(--border-color)] hover:border-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C6.5 6.253 2 10.998 2 17s4.5 10.747 10 10.747c5.5 0 10-4.998 10-10.747S17.5 6.253 12 6.253z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-color)]">Student</h3>
                    <p className="text-sm text-[var(--muted-color)]">Learn and take courses</p>
                  </div>
                </div>
              </button>

              {/* Instructor Option */}
              <button
                onClick={() => handleRoleSelect('instructor')}
                className="w-full p-4 border-2 rounded-xl border-[var(--border-color)] hover:border-[var(--secondary-color)] hover:bg-[var(--secondary-color)]/10 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--secondary-color)]/10 flex items-center justify-center text-[var(--secondary-color)] group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5.581m0 0H9m0 0h5.581m0 0a2.5 2.5 0 110-5h.581m-.581 5a2.5 2.5 0 110-5h.581m0 0H9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-color)]">Instructor</h3>
                    <p className="text-sm text-[var(--muted-color)]">Create and teach courses</p>
                  </div>
                </div>
              </button>

              {/* Admin Option */}
              <button
                onClick={() => handleRoleSelect('admin')}
                className="w-full p-4 border-2 rounded-xl border-[var(--border-color)] hover:border-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-all duration-200 text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[var(--primary-color)]/10 flex items-center justify-center text-[var(--primary-color)] group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--text-color)]">Administrator</h3>
                    <p className="text-sm text-[var(--muted-color)]">Manage platform and users</p>
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
              <p className="text-center text-sm text-[var(--muted-color)] mb-4">
                Don't have an account? Create one below:
              </p>
              <div className="flex gap-3">
                <Link
                  href="/register"
                  className="flex-1 px-4 py-2 bg-[var(--primary-color)] text-white text-sm font-semibold rounded-lg hover:brightness-95 transition-all duration-200 text-center"
                >
                  Student
                </Link>
                <Link
                  href="/instructor/register"
                  className="flex-1 px-4 py-2 bg-[var(--secondary-color)] text-white text-sm font-semibold rounded-lg hover:brightness-95 transition-all duration-200 text-center"
                >
                  Instructor
                </Link>
                <Link
                  href="/admin/register"
                  className="flex-1 px-4 py-2 bg-[var(--primary-color)] text-white text-sm font-semibold rounded-lg hover:brightness-95 transition-all duration-200 text-center"
                >
                  Admin
                </Link>
              </div>
            </div>

            <button
              onClick={() => setShowRoleModal(false)}
              className="w-full mt-4 py-2 text-[var(--muted-color)] hover:text-[var(--text-color)] transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative min-h-screen flex items-center justify-center pt-20 pb-16">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-6 xl:gap-8 items-center">
            {/* Left - Text Content (7 cols) */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8 animate-slide-up">
              <div className="space-y-4">
                <div className="inline-block">
                  <span className="px-4 py-2 rounded-full bg-[var(--primary-color)]/10 text-[var(--primary-color)] text-xs sm:text-sm font-semibold">
                    Welcome to Modern Learning
                  </span>
                </div>

                <h1 className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl xl:text-6xl font-display font-bold leading-tight text-[var(--text-color)]">
                  Learn, Teach, and{' '}
                  <span className="text-[var(--primary-color)]">
                    Grow Together
                  </span>
                </h1>

                <p className="text-base sm:text-lg md:text-lg lg:text-lg xl:text-xl text-[var(--muted-color)] max-w-2xl leading-relaxed">
                  A modern, professional learning management platform designed for organizations, instructors, and learners. Start your educational journey today.
                </p>
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 pt-2">
                <button
                  onClick={() => setShowRoleModal(true)}
                  className="inline-flex items-center justify-center px-8 sm:px-10 py-3 sm:py-4 bg-[var(--primary-color)] text-white font-semibold rounded-xl hover:brightness-95 transition-all duration-300 transform hover:scale-105 group whitespace-nowrap w-full sm:w-auto"
                >
                  Get Started
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>

                <button
                  onClick={() => setShowRoleModal(true)}
                  className="inline-flex items-center justify-center px-8 sm:px-10 py-3 sm:py-4 border-2 rounded-xl border-[var(--border-color)] text-[var(--text-color)] font-semibold hover:border-[var(--primary-color)] hover:text-[var(--primary-color)] hover:bg-[var(--primary-color)]/10 transition-all duration-300 group whitespace-nowrap w-full sm:w-auto"
                >
                  Sign In
                  <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {/* Features List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 sm:pt-6">
                {[
                  { icon: '📚', label: 'Courses' },
                  { icon: '👥', label: 'Collaboration' },
                  { icon: '📊', label: 'Analytics' },
                  { icon: '🎖️', label: 'Certificates' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-[var(--text-color)]">
                    <span className="text-2xl sm:text-3xl flex-shrink-0 text-[var(--secondary-color)]">{item.icon}</span>
                    <span className="font-medium text-sm sm:text-base">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Animated Illustration (5 cols) */}
            <div className="lg:col-span-6 relative w-full h-80 sm:h-96 lg:h-full flex items-center justify-center order-first lg:order-last mt-8 lg:mt-0 lg:min-h-screen">
              <div className="relative w-72 sm:w-80 md:w-96 lg:w-full lg:max-w-md h-80 sm:h-96 lg:h-96 xl:h-[450px]">
                {/* Book pages flip animation */}
                <div className="absolute inset-0 perspective">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute inset-0 rounded-xl shadow-2xl hero-panel"
                      style={{
                        animation: `flipBook ${2 + i * 0.5}s ease-in-out infinite`,
                        animationDelay: `${i * 0.3}s`,
                        transform: `translateX(${i * 8}px) scale(${1 - i * 0.05})`,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-[var(--text-color)] text-center">
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
                <div className="absolute -top-8 -right-8 w-24 sm:w-32 h-24 sm:h-32 rounded-full opacity-30 animate-float hero-glow-1" />
                <div className="absolute -bottom-8 -left-8 w-28 sm:w-36 h-28 sm:h-36 rounded-full opacity-20 animate-float hero-glow-2" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="py-16 sm:py-20 lg:py-28 px-4 sm:px-6 lg:px-8 relative">
        <div className="w-full max-w-7xl mx-auto 2xl:px-0">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[var(--text-color)] mb-4">
              Why Choose Our LMS?
            </h2>
            <p className="text-base sm:text-lg text-[var(--muted-color)] max-w-2xl mx-auto">
              Everything you need to create, manage, and deliver world-class learning experiences
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
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
                className="modern-card p-6 sm:p-8 text-center hover:scale-105 transition-transform duration-300"
              >
                <p className="text-4xl sm:text-5xl mb-4">{item.icon}</p>
                <h3 className="text-lg sm:text-xl font-bold text-[var(--text-color)] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm sm:text-base text-[var(--muted-color)]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] bg-[var(--card-color)]/80 py-12 sm:py-16 lg:py-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-7xl mx-auto 2xl:px-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8 mb-8">
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Security'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers'] },
              { title: 'Resources', links: ['Documentation', 'API', 'Support'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Contact'] },
            ].map((col, idx) => (
              <div key={idx}>
                <h4 className="font-semibold text-[var(--text-color)] mb-3 sm:mb-4 text-sm sm:text-base">{col.title}</h4>
                <ul className="space-y-2 sm:space-y-3">
                  {col.links.map((link, lidx) => (
                    <li key={lidx}>
                      <a href="#" className="text-xs sm:text-sm text-[var(--muted-color)] hover:text-[var(--primary-color)] transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-[var(--border-color)] pt-6 sm:pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[var(--muted-color)] text-xs sm:text-sm">
              © 2026 LMS Platform. All rights reserved.
            </p>
            <div className="flex gap-4 sm:gap-6">
              {['Twitter', 'GitHub', 'LinkedIn'].map((social, idx) => (
                <a
                  key={idx}
                  href="#"
                  className="text-[var(--muted-color)] hover:text-[var(--primary-color)] transition-colors text-xs sm:text-sm font-medium"
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
