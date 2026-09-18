'use client';
import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {cn} from '@/lib/utils';
export function Tabs(props:React.ComponentProps<typeof TabsPrimitive.Root>){return <TabsPrimitive.Root data-slot="tabs" {...props}/>;}
export function TabsList({className,...props}:React.ComponentProps<typeof TabsPrimitive.List>){return <TabsPrimitive.List data-slot="tabs-list" className={cn('tabs-list',className)} {...props}/>;}
export function TabsTrigger({className,...props}:React.ComponentProps<typeof TabsPrimitive.Trigger>){return <TabsPrimitive.Trigger data-slot="tabs-trigger" className={cn('tabs-trigger',className)} {...props}/>;}
export function TabsContent({className,...props}:React.ComponentProps<typeof TabsPrimitive.Content>){return <TabsPrimitive.Content data-slot="tabs-content" className={cn('tabs-content',className)} {...props}/>;}
