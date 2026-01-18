"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import Image from "next/image"
import { type Connection, type Edge, connections as allConnections, edges as allEdges } from "@/lib/data"
import { GraphLegend } from "./graph-legend"
import { Calendar, MapPin } from "lucide-react"

// Helper function to get initials from a name
function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(part => part.length > 0)
    .map(part => part.charAt(0).toUpperCase())
    .join('')
}

interface NetworkGraphProps {
  connections: Connection[]
  edges: Edge[]
  onNodeClick: (connection: Connection) => void
  filterMode?: "date" | "location" | null
  groupBy?: "none" | "date" | "role"
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string
  connection: Connection
  group?: string
  x?: number
  y?: number
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: SimulationNode | string
  target: SimulationNode | string
  strength: number
}

// Helper function to get group for a connection based on groupBy mode
function getGroup(connection: Connection, groupBy: string): string {
  if (groupBy === "date") {
    const now = new Date()
    const metDate = new Date(connection.metDate)
    const daysDiff = Math.floor((now.getTime() - metDate.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff <= 7) return "This Week"
    if (daysDiff <= 30) return "This Month"
    if (daysDiff <= 90) return "Last 3 Months"
    return "Earlier"
  }

  if (groupBy === "role") {
    // Extract role from tags
    const roleTags = ["engineer", "designer", "product", "founder", "investor"]
    const role = connection.tags.find(tag => roleTags.includes(tag.toLowerCase()))

    if (role) {
      const normalized = role.toLowerCase()
      if (normalized === "engineer") return "Engineer"
      if (normalized === "designer") return "Designer"
      if (normalized === "product") return "Product"
      if (normalized === "founder") return "Founder"
      if (normalized === "investor") return "Sales"
    }
    return "Other"
  }

  return "none"
}

// Helper function to get color for a group
function getGroupColor(group: string, groupBy: string): string {
  if (groupBy === "date") {
    const dateColors: Record<string, string> = {
      "This Week": "#3B82F6",
      "This Month": "#22C55E",
      "Last 3 Months": "#EAB308",
      "Earlier": "#6B7280"
    }
    return dateColors[group] || "#6B7280"
  }

  if (groupBy === "role") {
    const roleColors: Record<string, string> = {
      "Engineer": "#3B82F6",
      "Designer": "#A855F7",
      "Product": "#22C55E",
      "Sales": "#F97316",
      "Founder": "#EF4444",
      "Other": "#6B7280"
    }
    return roleColors[group] || "#6B7280"
  }

  return "#6B7280"
}

// Helper function to get cluster center position for a group
function getClusterCenter(
  group: string,
  allGroups: string[],
  width: number,
  height: number
): { x: number; y: number } {
  const index = allGroups.indexOf(group)
  const total = allGroups.length

  // Arrange clusters in a circle pattern
  if (total === 1) {
    return { x: width / 2, y: height / 2 }
  }

  // Calculate radius based on canvas size and number of groups
  const radius = Math.min(width, height) * 0.3
  const angle = (2 * Math.PI * index) / total - Math.PI / 2 // Start from top

  return {
    x: width / 2 + Math.cos(angle) * radius,
    y: height / 2 + Math.sin(angle) * radius
  }
}

export function NetworkGraph({ connections, edges, onNodeClick, filterMode, groupBy = "none" }: NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; connection: Connection } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        setDimensions({ width, height })
      }
    }
    
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  const getEdgeColor = useCallback((sourceId: string, targetId: string) => {
    if (!filterMode) return "rgba(100, 130, 180, 0.3)"
    
    const source = allConnections.find(c => c.id === sourceId)
    const target = allConnections.find(c => c.id === targetId)
    
    if (!source || !target) return "rgba(100, 130, 180, 0.3)"
    
    if (filterMode === "location") {
      // Color by location cluster
      const locationColors: Record<string, string> = {
        "San Francisco": "rgba(99, 102, 241, 0.5)",
        "New York": "rgba(236, 72, 153, 0.5)",
        "Boston": "rgba(34, 197, 94, 0.5)",
        "Seattle": "rgba(249, 115, 22, 0.5)",
        "Austin": "rgba(168, 85, 247, 0.5)",
        "Chicago": "rgba(14, 165, 233, 0.5)",
        "Denver": "rgba(234, 179, 8, 0.5)",
        "Los Angeles": "rgba(239, 68, 68, 0.5)",
      }
      if (source.location === target.location) {
        return locationColors[source.location] || "rgba(100, 130, 180, 0.5)"
      }
      return "rgba(100, 130, 180, 0.2)"
    }
    
    if (filterMode === "date") {
      // Color by time proximity
      const sourceDate = new Date(source.metDate).getTime()
      const targetDate = new Date(target.metDate).getTime()
      const diff = Math.abs(sourceDate - targetDate)
      const monthInMs = 30 * 24 * 60 * 60 * 1000
      
      if (diff < monthInMs) return "rgba(99, 102, 241, 0.6)"
      if (diff < 3 * monthInMs) return "rgba(99, 102, 241, 0.4)"
      return "rgba(99, 102, 241, 0.2)"
    }
    
    return "rgba(100, 130, 180, 0.3)"
  }, [filterMode])

  useEffect(() => {
    if (!svgRef.current || connections.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove()

    const { width, height } = dimensions

    // Create nodes from connections
    const nodes: SimulationNode[] = connections.map(c => ({
      id: c.id,
      connection: c,
      group: groupBy !== "none" ? getGroup(c, groupBy) : undefined,
    }))

    // Create links from edges (only if both nodes exist in filtered set)
    const nodeIds = new Set(nodes.map(n => n.id))
    const links: SimulationLink[] = edges
      .filter(e => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId))
      .map(e => ({
        source: e.sourceId,
        target: e.targetId,
        strength: e.defaultStrength,
      }))

    // Create container group for zoom/pan
    const g = svg.append("g")

    // Set up zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
      })

    svg.call(zoom)

    // Get unique groups for island clustering
    const groups = groupBy !== "none" ? [...new Set(nodes.map(n => n.group).filter(Boolean))] as string[] : []

    // Create force simulation with island clustering when groupBy is active
    const simulation = d3.forceSimulation<SimulationNode>(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links)
        .id(d => d.id)
        .distance(groupBy !== "none" ? 80 : 120)
        .strength(d => groupBy !== "none" ? d.strength * 0.3 : d.strength * 0.5))
      .force("charge", d3.forceManyBody().strength(groupBy !== "none" ? -200 : -300))
      .force("collision", d3.forceCollide().radius((d: SimulationNode) => {
        // Larger collision radius for bigger nodes and inter-group spacing
        return groupBy !== "none" ? 55 : 60
      }))

    // Apply island clustering forces when groupBy is active
    if (groupBy !== "none" && groups.length > 0) {
      // Strong pull to cluster centers
      simulation
        .force("clusterX", d3.forceX<SimulationNode>(d => {
          if (d.group) {
            const center = getClusterCenter(d.group, groups, width, height)
            return center.x
          }
          return width / 2
        }).strength(0.6))
        .force("clusterY", d3.forceY<SimulationNode>(d => {
          if (d.group) {
            const center = getClusterCenter(d.group, groups, width, height)
            return center.y
          }
          return height / 2
        }).strength(0.6))

      // Custom force to repel nodes from other cluster centers
      simulation.force("interClusterRepulsion", () => {
        nodes.forEach(node => {
          if (!node.group || !node.x || !node.y) return

          groups.forEach(group => {
            if (group !== node.group) {
              const center = getClusterCenter(group, groups, width, height)
              const dx = node.x! - center.x
              const dy = node.y! - center.y
              const distance = Math.sqrt(dx * dx + dy * dy)

              if (distance < 200) {
                const repulsionStrength = 2 * (200 - distance) / distance
                node.vx = (node.vx || 0) + dx * repulsionStrength
                node.vy = (node.vy || 0) + dy * repulsionStrength
              }
            }
          })
        })
      })
    } else {
      // Center force when no grouping
      simulation.force("center", d3.forceCenter(width / 2, height / 2))
    }

    // Add clustering force based on filter mode (legacy support)
    if (filterMode === "location" && groupBy === "none") {
      const locationCenters: Record<string, { x: number; y: number }> = {}
      const uniqueLocations = [...new Set(connections.map(c => c.location))]
      uniqueLocations.forEach((loc, i) => {
        const angle = (2 * Math.PI * i) / uniqueLocations.length
        locationCenters[loc] = {
          x: width / 2 + Math.cos(angle) * 150,
          y: height / 2 + Math.sin(angle) * 150,
        }
      })

      simulation.force("cluster", d3.forceX<SimulationNode>(d =>
        locationCenters[d.connection.location]?.x || width / 2
      ).strength(0.3))
      simulation.force("clusterY", d3.forceY<SimulationNode>(d =>
        locationCenters[d.connection.location]?.y || height / 2
      ).strength(0.3))
    } else if (filterMode === "date" && groupBy === "none") {
      // Cluster by month
      simulation.force("cluster", d3.forceX<SimulationNode>(d => {
        const month = new Date(d.connection.metDate).getMonth()
        return width * 0.2 + (month / 12) * width * 0.6
      }).strength(0.2))
    }

    // Draw links
    const link = g.append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", d => {
        const sourceId = typeof d.source === 'string' ? d.source : d.source.id
        const targetId = typeof d.target === 'string' ? d.target : d.target.id
        return getEdgeColor(sourceId, targetId)
      })
      .attr("stroke-width", 2)

    // Create node groups
    const node = g.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer")
      .call(d3.drag<SVGGElement, SimulationNode>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on("drag", (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }))

    // Node size constants - increased for better face visibility
    const NODE_RADIUS = 40  // Main avatar radius (was 28)
    const GROUP_RING_RADIUS = 48  // Color ring for grouping (was 34)
    const HOVER_RING_RADIUS = 45  // Hover effect ring (was 32)

    // Add group color ring when groupBy is active
    if (groupBy !== "none") {
      node.append("circle")
        .attr("r", GROUP_RING_RADIUS)
        .attr("fill", "none")
        .attr("stroke", d => d.group ? getGroupColor(d.group, groupBy) : "#6B7280")
        .attr("stroke-width", 5)
        .attr("class", "group-ring")
    }

    // Add outer ring (hover effect)
    node.append("circle")
      .attr("r", HOVER_RING_RADIUS)
      .attr("fill", "transparent")
      .attr("stroke", "rgba(99, 102, 241, 0)")
      .attr("stroke-width", 4)
      .attr("class", "node-ring")

    // Add clip path for images
    const defs = svg.append("defs")
    nodes.forEach(n => {
      defs.append("clipPath")
        .attr("id", `clip-${n.id}`)
        .append("circle")
        .attr("r", NODE_RADIUS)
    })

    // Add fallback background circle for nodes without avatars
    node.filter(d => !d.connection.avatarUrl)
      .append("circle")
      .attr("r", NODE_RADIUS)
      .style("fill", "var(--muted)")

    // Add initials text for nodes without avatars
    node.filter(d => !d.connection.avatarUrl)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .style("fill", "var(--muted-foreground)")
      .attr("font-size", NODE_RADIUS * 0.8)
      .attr("font-weight", "600")
      .text(d => getInitials(d.connection.name))

    // Add avatar images only for nodes with avatars
    node.filter(d => !!d.connection.avatarUrl)
      .append("image")
      .attr("xlink:href", d => d.connection.avatarUrl)
      .attr("x", -NODE_RADIUS)
      .attr("y", -NODE_RADIUS)
      .attr("width", NODE_RADIUS * 2)
      .attr("height", NODE_RADIUS * 2)
      .attr("clip-path", d => `url(#clip-${d.id})`)
      .attr("preserveAspectRatio", "xMidYMid slice")

    // Add border circle
    node.append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", "none")
      .attr("stroke", "rgba(255, 255, 255, 0.15)")
      .attr("stroke-width", 2)

    // Event handlers
    node
      .on("mouseenter", function(event, d) {
        d3.select(this).select(".node-ring")
          .transition()
          .duration(200)
          .attr("stroke", "rgba(99, 102, 241, 0.6)")
        
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top - 80,
            connection: d.connection,
          })
        }
      })
      .on("mouseleave", function() {
        d3.select(this).select(".node-ring")
          .transition()
          .duration(200)
          .attr("stroke", "rgba(99, 102, 241, 0)")
        setTooltip(null)
      })
      .on("click", (_, d) => {
        onNodeClick(d.connection)
      })

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as SimulationNode).x ?? 0)
        .attr("y1", d => (d.source as SimulationNode).y ?? 0)
        .attr("x2", d => (d.target as SimulationNode).x ?? 0)
        .attr("y2", d => (d.target as SimulationNode).y ?? 0)

      node.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Initial zoom to fit
    svg.call(zoom.transform, d3.zoomIdentity.translate(0, 0).scale(0.9))

    return () => {
      simulation.stop()
    }
  }, [connections, edges, dimensions, onNodeClick, filterMode, groupBy, getEdgeColor])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      
      {/* Enhanced Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 w-64 rounded-lg border border-border bg-card/95 backdrop-blur-sm shadow-xl overflow-hidden"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
          }}
        >
          <div className="p-3 space-y-2">
            {/* Header with Avatar */}
            <div className="flex items-start gap-2.5">
              <div className="relative h-10 w-10 rounded overflow-hidden border border-border flex-shrink-0">
                {tooltip.connection.avatarUrl ? (
                  <Image
                    src={tooltip.connection.avatarUrl}
                    alt={tooltip.connection.name}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground">
                    {getInitials(tooltip.connection.name)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">
                  {tooltip.connection.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {tooltip.connection.isStudent
                    ? tooltip.connection.major || tooltip.connection.institution || 'Student'
                    : tooltip.connection.role || tooltip.connection.industry}
                  {tooltip.connection.isStudent
                    ? tooltip.connection.institution && ` @ ${tooltip.connection.institution}`
                    : tooltip.connection.company && ` @ ${tooltip.connection.company}`}
                </p>
              </div>
            </div>

            {/* Location & Date */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-shrink-0" />
                <span>{tooltip.connection.location}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>
                  Met at {tooltip.connection.event || "networking event"} on{" "}
                  {new Date(tooltip.connection.metDate).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </span>
              </div>
            </div>

            {/* Tags */}
            {tooltip.connection.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tooltip.connection.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-3 py-1.5 bg-accent/30 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Click to view full profile
            </p>
          </div>
        </div>
      )}

      {/* Graph Legend */}
      <GraphLegend groupBy={groupBy} />

      {/* Empty state */}
      {connections.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">No connections match these filters.</p>
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => window.location.reload()}
            >
              Clear filters
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
