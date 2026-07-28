<?php

namespace App\Livewire\Auth;

use App\Services\AuthService;
use Illuminate\Support\Facades\Hash;
use Livewire\Attributes\Layout;
use Livewire\Component;

#[Layout('layouts.guest')]
class ForceChangePassword extends Component
{
    public string $password = '';
    public string $password_confirmation = '';

    public function submit(AuthService $authService)
    {
        $this->validate(['password' => ['required', 'string', 'min:8', 'confirmed']]);

        $user = auth()->user();
        $user->forceFill([
            'password' => Hash::make($this->password),
            'must_change_password' => false,
        ])->save();

        $authService->invalidateUserSessions($user);
        session(['session_version' => $user->session_version]);

        session()->flash('status', 'Password berhasil diperbarui.');

        return redirect()->route('dashboard');
    }

    public function render()
    {
        return view('livewire.auth.force-change-password');
    }
}
