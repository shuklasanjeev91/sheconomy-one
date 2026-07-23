import { useState } from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogTitle,
  AppBottomSheet,
  Avatar,
  Badge,
  BrandGradient,
  Button,
  Card,
  Checkbox,
  Circle,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogTitle,
  Field,
  H2,
  H3,
  Icons,
  Input,
  Label,
  ListItem,
  Menu,
  MenuContent,
  MenuItem,
  Popover,
  PopoverContent,
  Progress,
  RadioGroup,
  RadioGroupItemWithLabel,
  ScrollView,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectViewport,
  Separator,
  Slider,
  Spinner,
  Square,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Text,
  TextArea,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipArrow,
  TooltipContent,
  useAppToast,
  XStack,
  YStack,
} from '~/components/ui'
import { PageScroll } from '~/components/layout'

import { BRAND_NAME } from '~/config/brand'

export default function UiKitTab() {
  return (
    <PageScroll>
      <YStack padding="$4" gap="$8" paddingBottom="$2" width="100%">
        <YStack gap="$1">
          <Badge tone="brand" size="sm">
            Component library
          </Badge>
          <H2>{BRAND_NAME} UI Kit</H2>
          <Text color="$color10">
            Every category from the Tamagui component set, restyled once and reused
            everywhere — web, iOS and Android.
          </Text>
        </YStack>

        <Section title="Forms">
          <FormsDemo />
        </Section>

        <Section title="Menus">
          <MenusDemo />
        </Section>

        <Section title="Panels">
          <PanelsDemo />
        </Section>

        <Section title="Content">
          <ContentDemo />
        </Section>

        <Section title="Visual">
          <VisualDemo />
        </Section>
      </YStack>
    </PageScroll>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <YStack gap="$3">
      <XStack alignItems="center" gap="$3">
        <H3>{title}</H3>
        <Separator flex={1} />
      </XStack>
      {children}
    </YStack>
  )
}

function FormsDemo() {
  const [checked, setChecked] = useState(true)
  const [switchOn, setSwitchOn] = useState(false)
  const [radio, setRadio] = useState('a')
  const [toggle, setToggle] = useState('bold')
  const [slider, setSlider] = useState([40])
  const [fruit, setFruit] = useState('apple')

  return (
    <YStack gap="$4">
      <XStack gap="$3" flexWrap="wrap">
        <Button tone="primary">Primary</Button>
        <Button tone="secondary">Secondary</Button>
        <Button tone="outline">Outline</Button>
        <Button tone="ghost">Ghost</Button>
        <Button tone="destructive">Destructive</Button>
      </XStack>

      <Card gap="$4">
        <Field label="Email" hint="We'll never share it.">
          <Input placeholder="you@example.com" />
        </Field>
        <Field label="Message">
          <TextArea placeholder="Write something…" />
        </Field>

        <XStack alignItems="center" gap="$2.5">
          <Checkbox checked={checked} onCheckedChange={(v) => setChecked(!!v)} id="agree" />
          <Label htmlFor="agree">I agree to the terms</Label>
        </XStack>

        <XStack alignItems="center" justifyContent="space-between">
          <Label>Enable notifications</Label>
          <Switch checked={switchOn} onCheckedChange={setSwitchOn} />
        </XStack>

        <YStack gap="$2">
          <Label>Plan</Label>
          <RadioGroup value={radio} onValueChange={setRadio}>
            <RadioGroupItemWithLabel value="a" label="Starter" />
            <RadioGroupItemWithLabel value="b" label="Pro" />
            <RadioGroupItemWithLabel value="c" label="Team" />
          </RadioGroup>
        </YStack>

        <YStack gap="$2">
          <Label>Text style</Label>
          <ToggleGroup type="single" value={toggle} onValueChange={setToggle}>
            <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
            <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
            <ToggleGroupItem value="underline">Underline</ToggleGroupItem>
          </ToggleGroup>
        </YStack>

        <YStack gap="$2">
          <Label>Volume — {slider[0]}%</Label>
          <Slider value={slider} onValueChange={setSlider} max={100} step={1} />
        </YStack>

        <YStack gap="$2">
          <Label>Favorite fruit</Label>
          <Select value={fruit} onValueChange={setFruit}>
            <SelectTrigger width="100%" iconAfter={<Icons.ChevronDown size={16} />}>
              <Select.Value placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              <SelectViewport>
                {['apple', 'banana', 'cherry', 'durian'].map((item, i) => (
                  <SelectItem index={i} key={item} value={item}>
                    <Select.ItemText textTransform="capitalize">{item}</Select.ItemText>
                  </SelectItem>
                ))}
              </SelectViewport>
            </SelectContent>
          </Select>
        </YStack>
      </Card>
    </YStack>
  )
}

function MenusDemo() {
  return (
    <XStack gap="$4" flexWrap="wrap">
      <Menu>
        <Menu.Trigger asChild>
          <Button tone="outline" iconAfter={<Icons.ChevronDown size={16} />}>
            Dropdown menu
          </Button>
        </Menu.Trigger>
        <Menu.Portal>
          <MenuContent>
            <MenuItem>
              <Text>Edit</Text>
            </MenuItem>
            <MenuItem>
              <Text>Duplicate</Text>
            </MenuItem>
            <MenuItem>
              <Text color="$red10">Delete</Text>
            </MenuItem>
          </MenuContent>
        </Menu.Portal>
      </Menu>

      <ContextMenu>
        <ContextMenu.Trigger>
          <Card width={220} height={64} alignItems="center" justifyContent="center">
            <Text color="$color10">Right-click / long-press me</Text>
          </Card>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenuContent>
            <ContextMenuItem>
              <Text>Copy</Text>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu.Portal>
      </ContextMenu>
    </XStack>
  )
}

function PanelsDemo() {
  const toast = useAppToast()
  const [tab, setTab] = useState('one')

  return (
    <YStack gap="$4">
      <XStack gap="$3" flexWrap="wrap">
        <Dialog>
          <Dialog.Trigger asChild>
            <Button tone="outline">Open dialog</Button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>Delete item</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
              <XStack gap="$2" justifyContent="flex-end" marginTop="$2">
                <Dialog.Close asChild>
                  <Button tone="secondary">Cancel</Button>
                </Dialog.Close>
                <Dialog.Close asChild>
                  <Button tone="destructive">Delete</Button>
                </Dialog.Close>
              </XStack>
            </DialogContent>
          </Dialog.Portal>
        </Dialog>

        <AlertDialog>
          <AlertDialog.Trigger asChild>
            <Button tone="destructive">Sign out</Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialogOverlay />
            <AlertDialogContent>
              <AlertDialogTitle>Sign out of {BRAND_NAME}?</AlertDialogTitle>
              <AlertDialogDescription>
                You'll need to sign back in to access your account.
              </AlertDialogDescription>
              <XStack gap="$2" justifyContent="flex-end" marginTop="$2">
                <AlertDialog.Cancel asChild>
                  <Button tone="secondary">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button tone="destructive">Sign out</Button>
                </AlertDialog.Action>
              </XStack>
            </AlertDialogContent>
          </AlertDialog.Portal>
        </AlertDialog>

        <SheetDemo />

        <Popover>
          <Popover.Trigger asChild>
            <Button tone="outline">Open popover</Button>
          </Popover.Trigger>
          <PopoverContent>
            <Text>Popovers anchor to their trigger.</Text>
          </PopoverContent>
        </Popover>

        <Tooltip>
          <Tooltip.Trigger asChild>
            <Button tone="outline">Hover for tooltip</Button>
          </Tooltip.Trigger>
          <TooltipContent>
            <TooltipArrow />
            <Text color="white" fontSize="$2">
              Helpful context
            </Text>
          </TooltipContent>
        </Tooltip>

        <Button
          tone="outline"
          onPress={() => toast.show('Saved!', { message: 'Your changes are live.', tone: 'success' })}
        >
          Trigger toast
        </Button>
      </XStack>

      <Tabs value={tab} onValueChange={setTab} orientation="horizontal">
        <TabsList>
          <TabsTrigger value="one" active={tab === 'one'} flex={1}>
            <Text fontWeight="600">Overview</Text>
          </TabsTrigger>
          <TabsTrigger value="two" active={tab === 'two'} flex={1}>
            <Text fontWeight="600">Details</Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="one">
          <Text color="$color10">Overview content goes here.</Text>
        </TabsContent>
        <TabsContent value="two">
          <Text color="$color10">Details content goes here.</Text>
        </TabsContent>
      </Tabs>

      <Accordion type="single" collapsible>
        <AccordionItem value="a">
          <AccordionTrigger>
            <Text fontWeight="600">What platforms are supported?</Text>
          </AccordionTrigger>
          <AccordionContent>
            <Text color="$color10">Web, iOS and Android — from one codebase.</Text>
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="b">
          <AccordionTrigger>
            <Text fontWeight="600">Is it themeable?</Text>
          </AccordionTrigger>
          <AccordionContent>
            <Text color="$color10">Yes — light, dark, and a full token system.</Text>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </YStack>
  )
}

function SheetDemo() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button tone="outline" onPress={() => setOpen(true)}>
        Open sheet
      </Button>
      <AppBottomSheet open={open} onOpenChange={setOpen} title="Bottom sheet">
        <Text color="$color10">The native modal pattern, on every platform.</Text>
      </AppBottomSheet>
    </>
  )
}

function ContentDemo() {
  return (
    <YStack gap="$4">
      <XStack gap="$3" alignItems="center">
        <Avatar name="Grace Hopper" size="$5" />
        <Avatar name="Ada Lovelace" size="$5" />
        <Avatar src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" size="$5" />
      </XStack>

      <Card>
        <Text fontWeight="700" fontSize="$5">
          Card
        </Text>
        <Text color="$color10">
          Cards are the base surface for grouping related content, with optional
          elevation and interactive states.
        </Text>
      </Card>

      <Card padding="$0" overflow="hidden">
        <ListItem
          icon={<Icons.FileText size={18} color="$color9" />}
          title="Quarterly report.pdf"
          subTitle="2.4 MB"
          iconAfter={<Icons.Download size={16} color="$color9" />}
        />
      </Card>
    </YStack>
  )
}

function VisualDemo() {
  return (
    <YStack gap="$4">
      <BrandGradient height={80} borderRadius="$6" />
      <XStack gap="$4" alignItems="center">
        <Separator vertical height={40} />
        <Spinner size="large" />
        <Square size={40} backgroundColor="$color9" borderRadius="$3" />
        <Circle size={40} backgroundColor="$color9" />
      </XStack>
    </YStack>
  )
}