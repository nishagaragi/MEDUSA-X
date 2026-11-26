import { useState, useCallback, useEffect } from 'react'
import ReactFlow, {
  Node, Edge, Controls, Background,
  NodeTypes, useNodesState, useEdgesState,
  MarkerType, Panel,
} from 'reactflow'
import { Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePatients } from '@/hooks/usePatients'
import { useKnowledgeGraph } from '@/hooks/useAnalysis'
import { evidenceStatusConfig, cn } from '@/lib/utils'
import { EvidenceStatus } from '@/types'

const NODE_COLORS: Record<string, string> = {
  diagnosis: '#1d4ed8',
  medication: '#7c3aed',
  lab_test: '#0d9488',
  event: '#d97706',
  document: '#6b7280',
  statement: '#1c3a6e',
}

const EDGE_COLORS: Record<string, string> = {
  supports: '#16a34a',
  contradicts: '#dc2626',
  references: '#6b7280',
  occurred_before: '#0d9488',
  associated_with: '#1d4ed8',
  potentially_affects: '#d97706',
}

function ClinicalNode({ data }: { data: { label: string; nodeType: string; evidenceStatus: EvidenceStatus } }) {
  const color = NODE_COLORS[data.nodeType] ?? '#1c3a6e'
  const statusCfg = evidenceStatusConfig[data.evidenceStatus] ?? evidenceStatusConfig.uncertain
  return (
    <div
      className="rounded-lg border-2 p-2 max-w-[160px] bg-white shadow-sm"
      style={{ borderColor: color }}
    >
      <div className="text-xs font-semibold truncate" style={{ color }}>{data.label}</div>
      <div className="text-xs text-gray-400 capitalize">{data.nodeType}</div>
      <div className={cn("text-xs mt-0.5", statusCfg.color)}>{statusCfg.label}</div>
    </div>
  )
}

const nodeTypes: NodeTypes = { clinical: ClinicalNode }

export default function KnowledgeGraphPage() {
  const { data: patientsData } = usePatients(1, 100)
  const [selectedPatient, setSelectedPatient] = useState('')
  const { data: graphData, isLoading } = useKnowledgeGraph(selectedPatient || undefined)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Build ReactFlow nodes/edges when data arrives
  const rebuildGraph = useCallback(() => {
    if (!graphData?.data) return
    const { nodes: gNodes, edges: gEdges } = graphData.data

    const rfNodes: Node[] = gNodes.map(n => ({
      id: n.id,
      type: 'clinical',
      position: { x: n.position_x || Math.random() * 600, y: n.position_y || Math.random() * 400 },
      data: {
        label: n.label,
        nodeType: n.node_type,
        evidenceStatus: n.evidence_status,
        referenceId: n.reference_id,
      },
    }))

    const rfEdges: Edge[] = gEdges.map(e => ({
      id: e.id,
      source: e.source_node_id,
      target: e.target_node_id,
      label: e.relationship.replace(/_/g, ' '),
      type: 'smoothstep',
      style: { stroke: EDGE_COLORS[e.relationship] ?? '#6b7280', strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.relationship] ?? '#6b7280' },
      labelStyle: { fontSize: 10, fill: '#6b7280' },
    }))

    setNodes(rfNodes)
    setEdges(rfEdges)
  }, [graphData, setNodes, setEdges])

  // Rebuild when data changes
  useEffect(() => {
    if ((graphData?.data?.nodes?.length ?? 0) > 0) {
      rebuildGraph()
    }
  }, [graphData, rebuildGraph])

  const legendItems = Object.entries(NODE_COLORS).map(([type, color]) => ({ type, color }))
  const edgeLegend = Object.entries(EDGE_COLORS).map(([rel, color]) => ({ rel, color }))

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-900">Clinical Butterfly Effect</h1>
        <p className="text-gray-500 text-sm">
          Interactive knowledge graph showing how uncertain information propagates to downstream conclusions.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap items-center">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedPatient}
          onChange={e => { setSelectedPatient(e.target.value); setNodes([]); setEdges([]) }}
        >
          <option value="">— Select patient —</option>
          {patientsData?.data?.map(p => (
            <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>
          ))}
        </select>
        {graphData?.data && (
          <Button variant="outline" size="sm" onClick={rebuildGraph}>
            <Network className="w-4 h-4 mr-2" />
            Rebuild Layout
          </Button>
        )}
      </div>

      {!selectedPatient && (
        <div className="rounded-xl border border-gray-200 h-96 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Select a patient to view the knowledge graph</p>
          </div>
        </div>
      )}

      {selectedPatient && isLoading && (
        <div className="rounded-xl border border-gray-200 h-96 flex items-center justify-center">
          <div className="animate-spin w-8 h-8 border-4 border-navy-800 border-t-transparent rounded-full" />
        </div>
      )}

      {selectedPatient && !isLoading && nodes.length === 0 && (
        <div className="rounded-xl border border-gray-200 h-96 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <Network className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No graph data yet — run analysis to build the knowledge graph</p>
          </div>
        </div>
      )}

      {nodes.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden" style={{ height: 580 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodeTypes={nodeTypes}
            fitView
            onNodeClick={(_, node) => setSelectedNode(node.id)}
          >
            <Controls />
            <Background gap={16} size={1} color="#e5e7eb" />
            <Panel position="top-right" className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm max-w-[200px]">
              <p className="text-xs font-semibold text-gray-700 mb-2">Node Types</p>
              {legendItems.map(({ type, color }) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-gray-600 mb-0.5">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                </div>
              ))}
              <p className="text-xs font-semibold text-gray-700 mt-2 mb-1">Relationships</p>
              {edgeLegend.map(({ rel, color }) => (
                <div key={rel} className="flex items-center gap-1.5 text-xs text-gray-600 mb-0.5">
                  <div className="w-6 h-0.5 flex-shrink-0" style={{ background: color }} />
                  <span className="capitalize">{rel.replace('_', ' ')}</span>
                </div>
              ))}
            </Panel>
          </ReactFlow>
        </div>
      )}
    </div>
  )
}
