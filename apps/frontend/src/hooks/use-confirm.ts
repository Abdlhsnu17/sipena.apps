"use client"

import { ConfirmDialogContext } from "@/components/confirm-provider"
import { useContext } from "react"

export const useConfirm = () => {
  const confirm = useContext(ConfirmDialogContext)

  if (!confirm) {
    throw new Error("useConfirm harus digunakan di dalam ConfirmProvider")
  }

  return { confirm }
}
