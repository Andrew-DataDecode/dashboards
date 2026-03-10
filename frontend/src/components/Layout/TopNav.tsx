import { NavLink } from 'react-router-dom';
import { UserButton } from '@clerk/clerk-react';
import { Flex, Box } from '@chakra-ui/react';
import { usePermissions } from '../../hooks/usePermissions.ts';
import { navLinks } from '../../config/permissions.ts';

const TopNav = () => {
  const { canAccess } = usePermissions();

  const visibleLinks = navLinks.filter((link) => canAccess(link.path));

  return (
    <Flex
      as="nav"
      position="sticky"
      top="0"
      bg="bg.card"
      borderBottom="1px solid"
      borderColor="border.subtle"
      boxShadow="shadow.nav"
      zIndex="100"
      align="center"
      justify="space-between"
    >
      <Flex gap="0" h="56px" align="stretch">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.path === '/'}
            style={{ textDecoration: 'none' }}
          >
            {({ isActive }) => (
              <Flex
                align="center"
                px="6"
                h="100%"
                fontSize="14px"
                fontWeight={isActive ? "600" : "500"}
                color={isActive ? "accent.500" : "text.secondary"}
                cursor="pointer"
                transition="color 0.2s ease, border-color 0.2s ease"
                borderBottom="3px solid"
                borderColor={isActive ? "var(--chakra-colors-accent-500, #3b82f6)" : "transparent"}
                _hover={{ color: isActive ? "accent.500" : "text.primary" }}
              >
                {link.label}
              </Flex>
            )}
          </NavLink>
        ))}
      </Flex>
      <Box px="4" display="flex" alignItems="center">
        <UserButton afterSignOutUrl="/" />
      </Box>
    </Flex>
  );
};

export default TopNav;
