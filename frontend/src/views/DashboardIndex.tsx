import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Box, Heading, Grid } from '@chakra-ui/react'
import type { DashboardSummary } from '../types/dashboard'

export default function DashboardIndex() {
  const { getToken } = useAuth()
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const token = await getToken()
        const res = await fetch('/api/dashboards', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setDashboards(data.dashboards ?? [])
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [getToken])

  if (loading) {
    return <Box p="8" color="text.secondary" textAlign="center">Loading...</Box>
  }

  if (!dashboards.length) {
    return <Box p="8" color="text.secondary" textAlign="center">No dashboards available</Box>
  }

  return (
    <Box p="4" minH="calc(100vh - 56px)" bg="bg.page" overflowY="auto">
      <Heading size="lg" color="text.primary" fontWeight="600" fontSize="22px" mb="4">
        Dashboards
      </Heading>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        gap="4"
      >
        {dashboards.map((d) => (
          <Link
            to={`/dashboards/${d.slug}`}
            key={d.slug}
            style={{ textDecoration: 'none', color: 'inherit' }}
          >
            <Box
              bg="bg.card"
              border="1px solid"
              borderColor="border.subtle"
              borderRadius="12px"
              p="5"
              boxShadow="shadow.card"
              transition="box-shadow 0.2s ease, transform 0.2s ease"
              _hover={{ boxShadow: "shadow.cardHover", transform: "translateY(-1px)" }}
            >
              <Heading size="md" color="text.primary" fontWeight="600" fontSize="18px" mb="1">
                {d.title}
              </Heading>
              {d.description && (
                <Box fontSize="14px" color="text.secondary">{d.description}</Box>
              )}
            </Box>
          </Link>
        ))}
      </Grid>
    </Box>
  )
}
