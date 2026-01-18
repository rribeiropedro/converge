export interface Connection {
  id: string
  name: string
  avatarUrl: string
  location: string
  industry: string
  metDate: string
  summaryPlaceholder: string
  tags: string[]
  role?: string
  company?: string
  event?: string
}

export interface Edge {
  sourceId: string
  targetId: string
  defaultStrength: number
}

export const connections: Connection[] = [
  {
    id: "1",
    name: "Sarah Chen",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face",
    location: "San Francisco",
    industry: "Fintech",
    metDate: "2025-12-15",
    summaryPlaceholder: "Met at TechCrunch Disrupt. Discussed AI in banking.",
    tags: ["investor", "AI"],
    role: "VP of Product",
    company: "Stripe",
    event: "TechCrunch Disrupt 2025"
  },
  {
    id: "2",
    name: "Marcus Johnson",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    location: "New York",
    industry: "Healthcare",
    metDate: "2025-11-20",
    summaryPlaceholder: "Connected at health innovation summit.",
    tags: ["founder", "healthcare"],
    role: "CEO",
    company: "HealthTech Labs",
    event: "Health Innovation Summit"
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face",
    location: "Boston",
    industry: "Biotech",
    metDate: "2025-10-05",
    summaryPlaceholder: "Research collaboration discussion at MIT event.",
    tags: ["researcher", "biotech"],
    role: "Research Scientist",
    company: "MIT Labs",
    event: "MIT Biotech Conference"
  },
  {
    id: "4",
    name: "David Park",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face",
    location: "Seattle",
    industry: "Cloud Computing",
    metDate: "2025-09-18",
    summaryPlaceholder: "AWS re:Invent networking dinner.",
    tags: ["engineer", "cloud"],
    role: "Senior Engineer",
    company: "Amazon Web Services",
    event: "AWS re:Invent 2025"
  },
  {
    id: "5",
    name: "Aisha Patel",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face",
    location: "Austin",
    industry: "E-commerce",
    metDate: "2025-08-22",
    summaryPlaceholder: "SXSW panel on future of retail.",
    tags: ["marketing", "retail"],
    role: "Head of Marketing",
    company: "Shopify",
    event: "SXSW 2025"
  },
  {
    id: "6",
    name: "James Wilson",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face",
    location: "Chicago",
    industry: "Manufacturing",
    metDate: "2025-07-10",
    summaryPlaceholder: "Industry 4.0 conference introduction.",
    tags: ["operations", "manufacturing"],
    role: "COO",
    company: "Industrial IoT Co",
    event: "Industry 4.0 Conference"
  },
  {
    id: "7",
    name: "Lisa Zhang",
    avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&h=150&fit=crop&crop=face",
    location: "San Francisco",
    industry: "AI/ML",
    metDate: "2026-01-05",
    summaryPlaceholder: "AI Summit keynote speaker, discussed LLMs.",
    tags: ["AI", "researcher"],
    role: "AI Researcher",
    company: "OpenAI",
    event: "AI Summit 2026"
  },
  {
    id: "8",
    name: "Michael Brown",
    avatarUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face",
    location: "Denver",
    industry: "Clean Energy",
    metDate: "2025-06-15",
    summaryPlaceholder: "Climate tech meetup organizer.",
    tags: ["sustainability", "energy"],
    role: "Founder",
    company: "SolarNext",
    event: "Climate Tech Meetup"
  },
  {
    id: "9",
    name: "Rachel Kim",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face",
    location: "Los Angeles",
    industry: "Entertainment",
    metDate: "2025-12-01",
    summaryPlaceholder: "Streaming platform product lead.",
    tags: ["product", "media"],
    role: "Product Manager",
    company: "Netflix",
    event: "Content Summit LA"
  },
  {
    id: "10",
    name: "Alex Thompson",
    avatarUrl: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=150&h=150&fit=crop&crop=face",
    location: "Boston",
    industry: "Fintech",
    metDate: "2025-11-08",
    summaryPlaceholder: "Venture capital partner at seed fund.",
    tags: ["investor", "VC"],
    role: "Partner",
    company: "Sequoia Capital",
    event: "FinTech Forum Boston"
  }
]

export const edges: Edge[] = [
  { sourceId: "1", targetId: "7", defaultStrength: 0.8 },
  { sourceId: "1", targetId: "10", defaultStrength: 0.9 },
  { sourceId: "2", targetId: "3", defaultStrength: 0.7 },
  { sourceId: "3", targetId: "10", defaultStrength: 0.5 },
  { sourceId: "4", targetId: "7", defaultStrength: 0.6 },
  { sourceId: "5", targetId: "9", defaultStrength: 0.7 },
  { sourceId: "6", targetId: "8", defaultStrength: 0.5 },
  { sourceId: "7", targetId: "4", defaultStrength: 0.8 },
  { sourceId: "8", targetId: "6", defaultStrength: 0.6 },
  { sourceId: "9", targetId: "5", defaultStrength: 0.7 },
  { sourceId: "2", targetId: "6", defaultStrength: 0.4 },
  { sourceId: "1", targetId: "5", defaultStrength: 0.5 },
]

export const locations = [...new Set(connections.map(c => c.location))]
export const industries = [...new Set(connections.map(c => c.industry))]

export function getConnectionById(id: string): Connection | undefined {
  return connections.find(c => c.id === id)
}

export function filterConnections(
  dateRange?: { weeks?: number; months?: number },
  location?: string
): Connection[] {
  let filtered = [...connections]
  
  if (dateRange) {
    const now = new Date()
    let cutoffDate: Date
    
    if (dateRange.weeks) {
      cutoffDate = new Date(now.getTime() - dateRange.weeks * 7 * 24 * 60 * 60 * 1000)
    } else if (dateRange.months) {
      cutoffDate = new Date(now.setMonth(now.getMonth() - dateRange.months))
    } else {
      cutoffDate = new Date(0)
    }
    
    filtered = filtered.filter(c => new Date(c.metDate) >= cutoffDate)
  }
  
  if (location) {
    filtered = filtered.filter(c => c.location === location)
  }
  
  return filtered
}
