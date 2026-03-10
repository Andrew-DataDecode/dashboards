import type { ReactNode } from 'react';
import { Box, Flex, CardRoot, CardBody, SkeletonText, Button } from '@chakra-ui/react';

interface PanelWrapperProps {
  title: string;
  loading: boolean;
  error?: { error: string; error_type: string };
  onRetry?: () => void;
  headerActions?: ReactNode;
  children: ReactNode;
}

export default function PanelWrapper({ title, loading, error, onRetry, headerActions, children }: PanelWrapperProps) {
  return (
    <CardRoot bg="bg.card" borderColor="border.subtle" borderWidth="1px" borderRadius="12px" p="5" boxShadow="shadow.card" transition="box-shadow 0.2s" _hover={{ boxShadow: "shadow.cardHover" }}>
      <CardBody p="0">
        <Flex align="center" justify="space-between" mb="3">
          <Box color="text.secondary" fontSize="14px" fontWeight="500">{title}</Box>
          {headerActions && !loading && !error && (
            <Flex gap="1.5">
              {headerActions}
            </Flex>
          )}
        </Flex>
        {loading ? (
          <Box role="status" aria-live="polite">
            <Box className="sr-only">Loading {title}</Box>
            <SkeletonText noOfLines={3} gap="2" />
          </Box>
        ) : error ? (
          <Box textAlign="center" py="4" role="alert" aria-live="assertive">
            <Box
              as="span"
              display="inline-block"
              bg="status.red"
              color="white"
              fontSize="11px"
              fontWeight="600"
              px="2"
              py="0.5"
              borderRadius="4px"
              textTransform="uppercase"
            >
              {error.error_type}
            </Box>
            <Box
              as="p"
              color="text.secondary"
              fontSize="14px"
              my="2"
              maxH="60px"
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {error.error}
            </Box>
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                borderColor="border.default"
                color="accent.500"
                fontSize="13px"
              >
                Retry
              </Button>
            )}
          </Box>
        ) : (
          children
        )}
      </CardBody>
    </CardRoot>
  );
}
