import { Injectable } from '@angular/core';
import { supabase } from '@parchis/supabase';

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  get client() {
    return supabase;
  }
}
