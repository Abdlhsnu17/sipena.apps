"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { createContext, useCallback, useRef, useState, type ReactNode } from "react"

export type ConfirmDialogOptions = {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type ConfirmDialogState = {
  open: boolean
  title: string
  description: string
  confirmText: string
  cancelText: string
  destructive: boolean
}

type ConfirmDialogFn = (options?: string | ConfirmDialogOptions) => Promise<boolean>

const defaultState: ConfirmDialogState = {
  open: false,
  title: "Konfirmasi tindakan",
  description: "Apakah Anda yakin ingin melanjutkan?",
  confirmText: "Ya, lanjutkan",
  cancelText: "Batal",
  destructive: false,
}

export const ConfirmDialogContext = createContext<ConfirmDialogFn | null>(null)

export default function ConfirmProvider({ children }: { children: ReactNode }) {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(defaultState)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const closeDialog = useCallback((result: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(result)
      resolverRef.current = null
    }
    setDialogState((prev) => ({ ...prev, open: false }))
  }, [])

  const confirm = useCallback<ConfirmDialogFn>((options) => {
    return new Promise<boolean>((resolve) => {
      if (resolverRef.current) {
        resolverRef.current(false)
      }

      resolverRef.current = resolve

      if (typeof options === "string") {
        setDialogState({
          ...defaultState,
          open: true,
          description: options,
        })
        return
      }

      setDialogState({
        open: true,
        title: options?.title || defaultState.title,
        description: options?.description || defaultState.description,
        confirmText: options?.confirmText || defaultState.confirmText,
        cancelText: options?.cancelText || defaultState.cancelText,
        destructive: Boolean(options?.destructive),
      })
    })
  }, [])

  return (
    <ConfirmDialogContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) closeDialog(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogState.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogState.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => closeDialog(false)}>
              {dialogState.cancelText}
            </AlertDialogCancel>
            <AlertDialogAction
              className={dialogState.destructive ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500" : undefined}
              onClick={() => closeDialog(true)}
            >
              {dialogState.confirmText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDialogContext.Provider>
  )
}
