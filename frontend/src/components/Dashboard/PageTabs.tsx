import { Box, Heading, VStack } from '@chakra-ui/react';
import type { PageConfig } from '../../types/dashboard';

interface PageTabsProps {
  title: string;
  pages: PageConfig[];
  activePage: string;
  onPageChange: (id: string) => void;
}

export default function PageTabs({ title, pages, activePage, onPageChange }: PageTabsProps) {
  return (
    <Box
      w="210px"
      flexShrink={0}
      bg="bg.sidebar"
      borderRight="1px solid"
      borderRightColor="border.subtle"
      overflowY="auto"
    >
      <Box px="4" pt="6" pb="3">
        <Heading size="md" color="text.primary" fontWeight="600" fontSize="18px">
          {title}
        </Heading>
      </Box>
      <VStack gap="1" align="stretch" px="0" pb="4">
        {pages.map((page) => {
          const isActive = page.id === activePage;
          return (
            <Box
              key={page.id}
              as="button"
              textAlign="left"
              px="4"
              py="2"
              fontSize="14px"
              fontWeight={isActive ? '600' : '400'}
              color={isActive ? 'text.primary' : 'text.secondary'}
              bg={isActive ? 'bg.card' : 'transparent'}
              borderLeft="3px solid"
              borderLeftColor={isActive ? 'accent.500' : 'transparent'}
              cursor="pointer"
              _hover={!isActive ? { bg: 'rgba(0,0,0,0.05)' } : undefined}
              onClick={() => onPageChange(page.id)}
            >
              {page.label}
            </Box>
          );
        })}
      </VStack>
    </Box>
  );
}
