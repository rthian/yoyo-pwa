'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import JudgeVisualiser from '@/components/judge/JudgeVisualiser'

interface DivisionPageTabsProps {
  divisionId: string
  isHeadJudgeOrAdmin: boolean
  children: React.ReactNode
}

export default function DivisionPageTabs({
  divisionId,
  isHeadJudgeOrAdmin,
  children,
}: DivisionPageTabsProps) {
  if (!isHeadJudgeOrAdmin) {
    return <>{children}</>
  }

  return (
    <Tabs defaultValue="participants" className="w-full">
      <TabsList className="grid w-full grid-cols-2 max-w-[280px]">
        <TabsTrigger value="participants">Participants</TabsTrigger>
        <TabsTrigger value="visualiser">Visualiser</TabsTrigger>
      </TabsList>
      <TabsContent value="participants" className="mt-4">
        {children}
      </TabsContent>
      <TabsContent value="visualiser" className="mt-4">
        <JudgeVisualiser divisionId={divisionId} />
      </TabsContent>
    </Tabs>
  )
}
