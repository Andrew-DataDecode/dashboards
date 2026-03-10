import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Box, Flex, Heading, Button } from '@chakra-ui/react'
import ChartRenderer from '../ChartRenderer.tsx'
import type { ChatMessage, ChatResponse } from '../types/index.ts'

const API_URL = '/api/chat'

function formatMessage(text: string): React.ReactNode {
  if (!text) return text

  const lines = text.split('\n')
  const result: React.ReactNode[] = []
  let tableLines: string[] = []
  let inTable = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isTableRow = line.trim().startsWith('|') && line.trim().endsWith('|')
    const isSeparator = /^\|[\s\-:|]+\|$/.test(line.trim())

    if (isTableRow) {
      if (!inTable) inTable = true
      if (!isSeparator) tableLines.push(line.trim())
    } else {
      if (inTable && tableLines.length > 0) {
        result.push(renderTable(tableLines, String(i)))
        tableLines = []
        inTable = false
      }
      if (line.trim()) result.push(<p key={`p-${i}`} style={{ margin: '0.25rem 0' }}>{line}</p>)
    }
  }
  if (tableLines.length > 0) result.push(renderTable(tableLines, 'end'))
  return result
}

function renderTable(lines: string[], key: string): React.ReactNode {
  if (lines.length === 0) return null
  const rows = lines.map(line =>
    line.split('|').filter(c => c.trim() !== '').map(c => c.trim())
  )
  return (
    <Box as="table" key={`tbl-${key}`} w="100%" my="2" fontSize="0.85rem" css={{ borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          {rows[0].map((h, i) => (
            <Box as="th" key={i} px="3" py="1.5" textAlign="left" borderBottom="1px solid" borderColor="border.default" bg="#f0f0f0" fontWeight="600">
              {h}
            </Box>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.slice(1).map((row, ri) => (
          <Box as="tr" key={ri} _hover={{ bg: "#f8f8f8" }}>
            {row.map((cell, ci) => (
              <Box as="td" key={ci} px="3" py="1.5" textAlign="left" borderBottom="1px solid" borderColor="border.default">
                {cell}
              </Box>
            ))}
          </Box>
        ))}
      </tbody>
    </Box>
  )
}

function ChatView() {
  const { getToken } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setLoading(true)

    try {
      const token = await getToken()
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: text, session_id: sessionId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ChatResponse
      setSessionId(data.session_id)
      setMessages(prev => [...prev, {
        role: 'assistant', text: data.response, toolCalls: data.tool_calls, chartSpec: data.chart_spec,
      }])
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setMessages(prev => [...prev, { role: 'error', text: `Error: ${message}` }])
    } finally {
      setLoading(false)
    }
  }

  const msgBg = (role: string) => {
    if (role === 'user') return '#e8f0fe'
    if (role === 'error') return '#fce8e6'
    return '#f8f9fa'
  }

  return (
    <Flex direction="column" h="100%" maxW="800px" mx="auto">
      <Flex as="header" align="baseline" gap="4" p="4" borderBottom="1px solid" borderColor="border.default">
        <Heading size="md" fontSize="1.25rem" m="0">Chat</Heading>
        <Box color="text.secondary" fontSize="0.85rem">Tanit Semantic Layer</Box>
      </Flex>

      <Box flex="1" overflowY="auto" p="4">
        {messages.length === 0 && (
          <Box color="text.secondary" p="8" textAlign="center">
            <p>Ask questions about your data:</p>
            <Box as="ul" listStyleType="none" p="0">
              <Box as="li" py="1" color="#4a90d9">"What's the gross order value this month?"</Box>
              <Box as="li" py="1" color="#4a90d9">"How many orders by brand last month?"</Box>
              <Box as="li" py="1" color="#4a90d9">"What's the lab test positivity rate?"</Box>
            </Box>
          </Box>
        )}

        {messages.map((msg, i) => (
          <Box
            key={i}
            mb="4"
            px="4"
            py="3"
            borderRadius="8px"
            bg={msgBg(msg.role)}
            ml={msg.role === 'user' ? '4rem' : '0'}
            mr={msg.role === 'assistant' ? '2rem' : '0'}
            color={msg.role === 'error' ? '#c5221f' : undefined}
            opacity={msg.role === 'assistant' && loading && i === messages.length - 1 ? 0.6 : 1}
          >
            <Box fontSize="0.75rem" fontWeight="600" color="#666" mb="1">
              {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : 'Assistant'}
            </Box>
            <Box lineHeight="1.5">
              {msg.role === 'assistant' ? formatMessage(msg.text) : msg.text}
            </Box>
            {msg.chartSpec && (
              <ChartRenderer chartSpec={msg.chartSpec} />
            )}
            {msg.toolCalls && (
              <Box as="details" mt="2" fontSize="0.75rem" color="#888">
                <Box as="summary" cursor="pointer">{msg.toolCalls.length} tool call(s)</Box>
                {msg.toolCalls.map((tc, j) => (
                  <Box
                    as="pre"
                    key={j}
                    bg="#f5f5f5"
                    p="2"
                    borderRadius="4px"
                    mt="1"
                    fontSize="0.7rem"
                    overflowX="auto"
                  >
                    {tc.tool}({JSON.stringify(tc.input, null, 2)})
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        ))}

        {loading && (
          <Box mb="4" px="4" py="3" borderRadius="8px" bg="#f8f9fa" mr="2rem" opacity="0.6">
            <Box fontSize="0.75rem" fontWeight="600" color="#666" mb="1">Assistant</Box>
            <Box lineHeight="1.5">Querying data...</Box>
          </Box>
        )}
        <div ref={endRef} />
      </Box>

      <Flex p="4" borderTop="1px solid" borderColor="border.default" gap="2">
        <textarea
          style={{
            flex: 1,
            padding: '0.75rem',
            border: '1px solid var(--chakra-colors-border-default, #e5e7eb)',
            borderRadius: '8px',
            fontSize: '0.95rem',
            resize: 'none',
            fontFamily: 'inherit',
          }}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Ask about your data..."
          disabled={loading}
        />
        <Button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          bg="#4a90d9"
          color="white"
          borderRadius="8px"
          px="6"
          fontSize="0.95rem"
          _hover={{ bg: "#3a7bc8" }}
          _disabled={{ opacity: 0.5, cursor: "not-allowed" }}
        >
          Send
        </Button>
      </Flex>
    </Flex>
  )
}

export default ChatView
