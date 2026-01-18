"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function LandingPage() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    const targets = Array.from(document.querySelectorAll(".reveal"))
    targets.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <div className="font-secondary bg-dark-bg text-text-primary overflow-x-hidden selection:bg-brand selection:text-white">
      <div className="fixed inset-0 z-[-1] bg-[#050505] overflow-hidden pointer-events-none">
        <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
        <div className="absolute top-[-500px] left-1/2 -translate-x-1/2 w-[2000px] h-[2000px] bg-[radial-gradient(circle,rgba(0,212,255,0.15)_0%,rgba(0,150,255,0.05)_50%,transparent_85%)] blur-[120px] animate-pulse-slow"></div>
        <div className="absolute top-[-350px] left-1/2 -translate-x-1/2 w-[1100px] h-[1100px] bg-[#050505] rounded-full shadow-[0_0_250px_80px_rgba(0,0,0,1)] z-0">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_15%,#151515_0%,#050505_55%)]"></div>
          <div className="absolute -inset-[2px] rounded-full bg-gradient-to-b from-brand/30 to-transparent blur-xl -z-10 opacity-90"></div>
        </div>
      </div>

      <div className="fixed top-6 left-0 right-0 z-50 flex justify-center px-6">
        <nav className="group relative flex items-center gap-2 p-1 bg-[#111]/80 backdrop-blur-xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-500 hover:border-brand/40">
          <a href="#" className="flex items-center gap-3 pl-4 pr-2 py-2 group/logo">
            <div className="relative w-8 h-8 flex items-center justify-center">
              <div className="absolute inset-0 bg-brand rounded-full blur-md opacity-0 group-hover/logo:opacity-100 transition-opacity"></div>
              <div className="relative w-6 h-6 bg-white rounded-full flex items-center justify-center transition-transform group-hover/logo:rotate-[360deg]">
                <div className="w-2.5 h-2.5 bg-dark-bg rounded-full"></div>
              </div>
            </div>
            <span className="font-bold text-white tracking-tight">Converge</span>
          </a>
          <div className="h-6 w-px bg-white/10 ml-2 hidden md:block"></div>
          <div className="hidden md:flex items-center gap-1 px-2">
            <a href="#how-it-works" className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-white rounded-full transition-all">
              How it Works
            </a>
            <a href="#features" className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-white rounded-full transition-all">
              Features
            </a>
            <a href="#pipeline" className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-white rounded-full transition-all">
              Architecture
            </a>
          </div>
          <Link href="/auth" className="px-6 py-2.5 bg-white rounded-full text-dark-bg text-sm font-bold transition-all hover:bg-brand hover:text-white">
            Start Recalling
          </Link>
        </nav>
      </div>

      <main>
        <section className="pt-48 pb-24 text-center relative overflow-hidden px-6">
          <div className="max-w-[1200px] mx-auto reveal active">
            <span className="block text-brand text-xs font-semibold uppercase tracking-[2px] mb-5">
              Professional Networking, Upgraded
            </span>
            <h1 className="font-primary text-5xl md:text-8xl leading-[1.05] mb-8">
              Never forget a
              <br />
              <span className="text-brand">connection</span> again.
            </h1>
            <p className="max-w-2xl mx-auto text-[#888] text-lg md:text-xl mb-12">
              Converge transforms networking conversations into a living, searchable memory of your professional world. Capture audio, video, and visual cues instantly.
            </p>

            <div className="max-w-[800px] mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-20 text-left">
              <div className="bg-dark-card/50 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                <p className="text-xs text-brand font-bold uppercase mb-2">Voice Query</p>
                <p className="text-white text-sm">"Who was that VC I talked to first today?"</p>
              </div>
              <div className="bg-dark-card/50 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                <p className="text-xs text-brand font-bold uppercase mb-2">Location Query</p>
                <p className="text-white text-sm">"Who did I meet at NexHacks who works in AI?"</p>
              </div>
              <div className="bg-dark-card/50 border border-white/10 p-5 rounded-2xl backdrop-blur-sm">
                <p className="text-xs text-brand font-bold uppercase mb-2">Visual Query</p>
                <p className="text-white text-sm">"Person in a blue shirt by the Stripe booth."</p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-24 px-6 border-t border-white/5 bg-[#080808]">
          <div className="max-w-[1200px] mx-auto">
            <div className="text-center mb-20 reveal">
              <h2 className="font-primary text-4xl md:text-6xl mb-6">
                Capture the moment,
                <br />
                keep the context.
              </h2>
              <div className="flex flex-wrap justify-center gap-4 text-sm font-bold tracking-widest uppercase text-brand">
                <span>Record</span>
                <span className="text-white/20">-&gt;</span>
                <span>Extract</span>
                <span className="text-white/20">-&gt;</span>
                <span>Approve</span>
                <span className="text-white/20">-&gt;</span>
                <span>Remember</span>
                <span className="text-white/20">-&gt;</span>
                <span>Follow up</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
              <div className="space-y-12 reveal">
                <div className="flex gap-6">
                  <div className="w-12 h-12 shrink-0 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center text-brand">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="8"></circle>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Audio &amp; Video Record</h3>
                    <p className="text-[#888]">
                      LiveKit-powered pipeline records every micro-interaction with high fidelity, ensuring no detail is lost to noise.
                    </p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 shrink-0 bg-brand/10 border border-brand/20 rounded-xl flex items-center justify-center text-brand">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                      <path strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold mb-2">Extraction &amp; Visual Memory</h3>
                    <p className="text-[#888]">
                      Our Overshoot pipeline captures face embeddings and visual descriptions--clothing, stance, and environment--to build a multi-sensory connection profile.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative reveal">
                <div className="aspect-square bg-dark-card border border-white/10 rounded-3xl p-8 overflow-hidden">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/10">
                      <div className="w-12 h-12 bg-gray-800 rounded-full overflow-hidden">
                        <img
                          src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=100&q=80"
                          className="w-full h-full object-cover"
                          alt="Profile"
                        />
                      </div>
                      <div>
                        <div className="text-white font-bold text-sm">John Doe (Extracted)</div>
                        <div className="text-brand text-xs">98% Face Match Confidence</div>
                      </div>
                    </div>
                    <div className="msg-anim msg-a1 space-y-2">
                      <div className="h-2 w-3/4 bg-white/10 rounded"></div>
                      <div className="h-2 w-1/2 bg-white/10 rounded"></div>
                      <div className="text-[10px] text-white/40">
                        "Blue linen shirt, glasses, talking about Web3 in London."
                      </div>
                    </div>
                    <div className="p-4 border border-brand/30 rounded-xl bg-brand/5 mt-8">
                      <div className="text-xs font-bold uppercase mb-2">Entity Extraction</div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-black/40 p-1 px-2 rounded">Company: Stripe</div>
                        <div className="bg-black/40 p-1 px-2 rounded">Role: VP Product</div>
                        <div className="bg-black/40 p-1 px-2 rounded">Topic: API Design</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-24 px-6">
          <div className="max-w-[1200px] mx-auto">
            <div className="mb-16 reveal">
              <h2 className="font-primary text-4xl md:text-5xl mb-6">
                Designed for
                <br />
                natural human recall.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-dark-card border border-white/10 p-10 rounded-3xl reveal">
                <h3 className="text-2xl font-bold mb-4">Inline Review &amp; Editing</h3>
                <p className="text-[#888] mb-8">
                  AI-generated drafts of your meetings are ready for instant review. Correct names, tweak roles, and confirm connections with a single tap before they enter your permanent memory.
                </p>
                <div className="h-40 bg-black rounded-xl p-4 border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-mono text-white/30">DRAFT_ID: 9283</span>
                    <span className="text-xs bg-brand text-white px-2 py-0.5 rounded">Pending Approval</span>
                  </div>
                  <div className="text-sm border-l-2 border-brand/50 pl-4 py-1 italic text-white/70">
                    "...discussed moving their <span className="bg-white/10 text-white px-1">frontend</span> to React next quarter."
                  </div>
                </div>
              </div>
              <div className="bg-dark-card border border-white/10 p-10 rounded-3xl reveal">
                <h3 className="text-2xl font-bold mb-4">Natural Language Querying</h3>
                <p className="text-[#888] mb-8">
                  Stop scrolling. Ask Converge about your network like you'd ask a friend. Powered by MongoDB Atlas Vector Search for semantic understanding.
                </p>
                <div className="h-40 flex items-center justify-center bg-brand/5 rounded-xl border border-brand/20">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-brand rounded-full mx-auto flex items-center justify-center mb-3 animate-pulse">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path>
                      </svg>
                    </div>
                    <span className="text-xs font-bold text-white uppercase tracking-tighter">Listening for query...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="pipeline" className="py-24 bg-[#080808] border-y border-white/5">
          <div className="max-w-[1200px] mx-auto px-6 reveal">
            <span className="text-brand text-xs font-semibold uppercase tracking-[2px] block mb-5">
              Hardware-Accelerated Memory
            </span>
            <h2 className="font-primary text-4xl mb-12">The Capture Pipeline</h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 bg-dark-card rounded-2xl border border-white/10">
                <div className="text-brand font-mono text-sm mb-4">01 // Audio</div>
                <h4 className="font-bold mb-2">LiveKit</h4>
                <p className="text-xs text-[#666]">Real-time speaker diarization to correctly identify who is talking.</p>
              </div>
              <div className="p-6 bg-dark-card rounded-2xl border border-white/10">
                <div className="text-brand font-mono text-sm mb-4">02 // Video</div>
                <h4 className="font-bold mb-2">Overshoot</h4>
                <p className="text-xs text-[#666]">Vision transformer extracts high-dimensional face embeddings for instant recognition.</p>
              </div>
              <div className="p-6 bg-dark-card rounded-2xl border border-white/10">
                <div className="text-brand font-mono text-sm mb-4">03 // Storage</div>
                <h4 className="font-bold mb-2">MongoDB Atlas</h4>
                <p className="text-xs text-[#666]">Hybrid vector search across conversations and visual visual traits.</p>
              </div>
              <div className="p-6 bg-dark-card rounded-2xl border border-white/10">
                <div className="text-brand font-mono text-sm mb-4">04 // Core</div>
                <h4 className="font-bold mb-2">React/Express</h4>
                <p className="text-xs text-[#666]">Low-latency interface to manage your growing network graph.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-24 px-6 bg-dark-bg">
          <div className="max-w-[1200px] mx-auto reveal">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
              <div>
                <h2 className="font-primary text-4xl mb-8">
                  Challenges &amp;
                  <br />
                  Accomplishments
                </h2>
                <div className="space-y-6">
                  <div className="p-5 border-l-2 border-brand bg-white/5">
                    <h4 className="font-bold mb-1">Speaker Separation</h4>
                    <p className="text-sm text-[#888]">
                      Solved multi-voice interference in crowded conference halls using advanced beamforming and diarization.
                    </p>
                  </div>
                  <div className="p-5 border-l-2 border-white/20 bg-white/5">
                    <h4 className="font-bold mb-1">Low-Light Identification</h4>
                    <p className="text-sm text-[#888]">
                      Optimized visual embeddings to work reliably even in dimly lit networking venues.
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-brand/10 p-10 rounded-3xl border border-brand/20">
                <h3 className="font-primary text-3xl mb-6">Future Roadmap</h3>
                <ul className="space-y-4 font-medium">
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>
                    <span>Smart follow-up suggestions</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>
                    <span>LinkedIn enrichment automation</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>
                    <span>Network graph visualization</span>
                  </li>
                  <li className="flex items-center gap-3 text-white/40">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                    <span>Advanced analytics dashboard</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="py-32 px-6 text-center">
          <div className="max-w-[1200px] mx-auto reveal">
            <h2 className="font-primary text-5xl md:text-7xl mb-8">Capture your network.</h2>
            <div className="flex justify-center gap-4">
              <Link href="/auth" className="bg-white text-dark-bg px-10 py-4 mt-4 rounded-full font-bold hover:bg-brand hover:text-white transition-colors">
                Start Now
              </Link>
              {/* <button className="bg-transparent border border-white/20 text-white px-10 py-4 rounded-full font-bold hover:border-white transition-colors">
                Read Docs
              </button> */}
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-dark-bg border-t border-dark-border py-16 text-sm text-text-secondary">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap justify-between gap-10">
          <div className="min-w-[140px]">
            <h6 className="text-white mb-5 font-semibold">Converge</h6>
            <ul className="space-y-3">
              <li className="hover:text-brand cursor-pointer">Mobile App</li>
              <li className="hover:text-brand cursor-pointer">Web Dashboard</li>
              <li className="hover:text-brand cursor-pointer">Vector Search</li>
            </ul>
          </div>
          <div className="min-w-[140px]">
            <h6 className="text-white mb-5 font-semibold">Legal</h6>
            <ul className="space-y-3">
              <li className="hover:text-brand cursor-pointer">Privacy</li>
              <li className="hover:text-brand cursor-pointer">Biometric Policy</li>
            </ul>
          </div>
        </div>
        <div className="max-w-[1200px] mx-auto px-6 mt-16 pt-8 border-t border-dark-border text-xs">
          <p>(c) 2024 Converge AI. Built for the era of effortless networking.</p>
        </div>
      </footer>
    </div>
  )
}
