import { Accordion as TAccordion, styled } from 'tamagui'

export const Accordion = TAccordion

export const AccordionItem = styled(TAccordion.Item, {
  name: 'AccordionItem',
  borderRadius: '$5',
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: '$borderColor',
})

export const AccordionTrigger = styled(
  TAccordion.Trigger,
  {
    name: 'AccordionTrigger',
    backgroundColor: '$color2',
    paddingHorizontal: '$4',
    paddingVertical: '$3.5',
    fontWeight: '600',
    hoverStyle: { backgroundColor: '$color3' },
  } as any
)

export const AccordionContent = styled(TAccordion.Content, {
  name: 'AccordionContent',
  backgroundColor: '$background',
  paddingHorizontal: '$4',
  paddingVertical: '$3.5',
})