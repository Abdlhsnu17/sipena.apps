<?php

namespace App\Livewire\Auth;

use App\Services\AuthService;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.guest')]
class Register extends Component
{
    public string $nip = '';
    public string $name = '';
    public string $email = '';
    public string $phone_number = '';
    public string $password = '';
    public string $password_confirmation = '';

    public function submit(AuthService $authService)
    {
        $this->validate([
            'nip' => ['required', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255'],
            'phone_number' => ['required', 'string', 'max:25'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $result = $authService->register($this->only(['nip', 'name', 'email', 'phone_number', 'password']));

        if (!$result['success']) {
            $this->addError('nip', $result['message']);

            return;
        }

        session()->flash('status', 'Pendaftaran berhasil. Silakan masuk dengan akun Anda.');

        return redirect()->route('login');
    }

    public function render()
    {
        return view('livewire.auth.register');
    }
}
