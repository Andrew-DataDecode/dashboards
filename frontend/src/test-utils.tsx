import type { ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { ChakraProvider } from '@chakra-ui/react';
import { system } from './theme';

function Wrapper({ children }: { children: ReactNode }) {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
}

function renderWithChakra(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Wrapper, ...options });
}

export { renderWithChakra as render };
export { screen, fireEvent, waitFor } from '@testing-library/react';
