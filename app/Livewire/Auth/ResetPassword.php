<?php

namespace App\Livewire\Auth;

use App\Services\AuthService;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.guest')]
class ResetPassword extends Component
{
    public string $nip = '';
    public string $verification_code = '';
    public string $password = '';
    public string $password_confirmation = '';

    public function mount(string $nip = '')
    {
        $this->nip = $nip;
    }

    public function submit(AuthService $authService)
    {
        $this->validate([
            'nip' => ['required', 'string'],
            'verification_code' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $result = $authService->resetPasswordWithCode($this->nip, $this->verification_code, $this->password);

        if (!$result['success']) {
            $this->addError('verification_code', $result['message']);

            return;
        }

        session()->flash('status', $result['message']);

        return redirect()->route('login');
    }

    public function render()
    {
        return view('livewire.auth.reset-password');
    }
}
