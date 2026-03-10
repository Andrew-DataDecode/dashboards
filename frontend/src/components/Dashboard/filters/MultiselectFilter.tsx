import { useState, useRef, useEffect, useId } from 'react';
import { Box, Button } from '@chakra-ui/react';

interface MultiselectFilterProps {
  label: string;
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}

export default function MultiselectFilter({ label, options, value, onChange }: MultiselectFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const display = value.length === 0
    ? 'All'
    : value.length === 1
      ? value[0]
      : `${value.length} selected`;

  const toggle = (opt: string) => {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt));
    } else {
      onChange([...value, opt]);
    }
  };

  return (
    <Box position="relative" ref={ref}>
      <Box as="label" display="block" fontSize="14px" fontWeight="500" color="text.secondary" mb="1">
        {label}
      </Box>
      <Button
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        aria-label={`${label} filter: ${display}`}
        onClick={() => setOpen(!open)}
        borderColor="border.subtle"
        color="text.primary"
        fontWeight="normal"
        justifyContent="space-between"
        minW="160px"
      >
        {display}
        <Box as="span" ml="2">{open ? '\u25B4' : '\u25BE'}</Box>
      </Button>
      {open && (
        <Box
          id={listboxId}
          role="listbox"
          aria-label={label}
          position="absolute"
          top="100%"
          left="0"
          mt="1"
          bg="bg.card"
          border="1px solid"
          borderColor="border.subtle"
          borderRadius="8px"
          boxShadow="md"
          zIndex="10"
          minW="200px"
          maxH="240px"
          overflowY="auto"
        >
          <Box p="2" borderBottom="1px solid" borderColor="border.subtle">
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onChange([])}
              color="accent.500"
            >
              Clear
            </Button>
          </Box>
          {options.map((opt) => (
            <Box
              as="label"
              key={opt}
              role="option"
              aria-selected={value.includes(opt)}
              display="flex"
              alignItems="center"
              gap="2"
              px="3"
              py="1.5"
              cursor="pointer"
              fontSize="14px"
              _hover={{ bg: "table.hover" }}
            >
              <input
                type="checkbox"
                checked={value.includes(opt)}
                onChange={() => toggle(opt)}
              />
              {opt}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}
