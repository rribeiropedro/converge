"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import * as d3 from "d3"
import { type Connection, type Edge, connections as allConnections, edges as allEdges } from "@/lib/data"

interface NetworkGraphProps {
  connections: Connection[]
  edges: Edge[]
  onNodeClick: (connection: Connection) => void
  filterMode?: "date" | "location" | null
}

interface SimulationNode extends d3.SimulationNodeDatum {
  id: string
  connection: Connection
  x?: number
  y?: number
}

interface SimulationLink extends d3.SimulationLinkDatum<SimulationNode> {
  source: SimulationNode | string
  target: SimulationNode | string
  strength: number
}

export function NetworkGraph({ connections, edges, onNodeClick, filterMode }: NetworkGraphProps) {
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

    // Create force simulation
    const simulation = d3.forceSimulation<SimulationNode>(nodes)
      .force("link", d3.forceLink<SimulationNode, SimulationLink>(links)
        .id(d => d.id)
        .distance(120)
        .strength(d => d.strength * 0.5))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(50))

    // Add clustering force based on filter mode
    if (filterMode === "location") {
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
    } else if (filterMode === "date") {
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

    // Add outer ring (hover effect)
    node.append("circle")
      .attr("r", 32)
      .attr("fill", "transparent")
      .attr("stroke", "rgba(99, 102, 241, 0)")
      .attr("stroke-width", 3)
      .attr("class", "node-ring")

    // Add clip path for images
    const defs = svg.append("defs")
    nodes.forEach(n => {
      defs.append("clipPath")
        .attr("id", `clip-${n.id}`)
        .append("circle")
        .attr("r", 28)
    })

    // Add avatar images
    node.append("image")
      .attr("xlink:href", d => d.connection.avatarUrl)
      .attr("x", -28)
      .attr("y", -28)
      .attr("width", 56)
      .attr("height", 56)
      .attr("clip-path", d => `url(#clip-${d.id})`)
      .attr("preserveAspectRatio", "xMidYMid slice")

    // Add border circle
    node.append("circle")
      .attr("r", 28)
      .attr("fill", "none")
      .attr("stroke", "rgba(255, 255, 255, 0.1)")
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
  }, [connections, edges, dimensions, onNodeClick, filterMode, getEdgeColor])

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      
      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-50 rounded-lg border border-border bg-popover p-3 shadow-lg"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-medium text-foreground text-sm">{tooltip.connection.name}</p>
          <p className="text-xs text-muted-foreground">{tooltip.connection.location}</p>
          <p className="text-xs text-primary">{tooltip.connection.industry}</p>
        </div>
      )}

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
