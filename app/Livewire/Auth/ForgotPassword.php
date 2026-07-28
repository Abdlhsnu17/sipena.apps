<?php

namespace App\Livewire\Auth;

use App\Services\AuthService;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.guest')]
class ForgotPassword extends Component
{
    public string $nip = '';
    public ?string $infoMessage = null;
    public ?string $previewCode = null;

    public function submit(AuthService $authService)
    {
        $this->validate(['nip' => ['required', 'string']]);

        $result = $authService->requestPasswordResetCode($this->nip);

        if (!$result['success']) {
            $this->addError('nip', $result['message']);

            return;
        }

        session()->flash('reset_info', $result['message'] . (isset($result['deliveryTarget']) ? " (Target: {$result['deliveryTarget']})" : ''));
        session()->flash('reset_preview_code', $result['previewCode'] ?? null);

        return redirect()->route('password.reset', ['nip' => $this->nip]);
    }

    public function render()
    {
        return view('livewire.auth.forgot-password');
    }
}
